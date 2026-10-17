// Tests for the designation rules without the network: strings and tables built here, never copies of Wikidata's
// or the WGSN's data. The transform's determinism on the real responses is checked with `--from-raw` (see
// scripts/build-star-designations.mjs).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildDesignationTables,
  CONSTELLATION_GENITIVES,
  bayerAbbreviation,
  chooseDesignation,
  flamsteedNumber,
  GREEK_ABBREVIATIONS,
  labelDesignation,
  namesByHip,
  overrideFor,
  parseIauTable,
  validateOverrides,
} from "./designations.mjs";

describe("bayerAbbreviation", () => {
  it("maps all 24 Greek letters to the app's three-letter abbreviations", () => {
    const letters = "αβγδεζηθικλμνξοπρστυφχψω";
    const abbreviations = [
      "Alp", "Bet", "Gam", "Del", "Eps", "Zet", "Eta", "The", "Iot", "Kap", "Lam", "Mu",
      "Nu", "Xi", "Omi", "Pi", "Rho", "Sig", "Tau", "Ups", "Phi", "Chi", "Psi", "Ome",
    ]; // prettier-ignore
    expect([...letters]).toHaveLength(24);
    expect(Object.keys(GREEK_ABBREVIATIONS)).toEqual([...letters]);
    [...letters].forEach((letter, i) => {
      expect(bayerAbbreviation(`${letter} And`)).toEqual({ bayer: abbreviations[i], con: "And" });
    });
    // The omicron is the Greek one (U+03BF), not the Latin "o".
    expect("ο".codePointAt(0)).toBe(0x03bf);
    expect(bayerAbbreviation("ο Cet")).toEqual({ bayer: "Omi", con: "Cet" });
  });

  it("writes a superscript as -n, digit by digit, and reads the ASCII digit form", () => {
    expect(bayerAbbreviation("π¹ Ori")).toEqual({ bayer: "Pi-1", con: "Ori" });
    expect(bayerAbbreviation("ν² Boo")).toEqual({ bayer: "Nu-2", con: "Boo" });
    expect(bayerAbbreviation("ψ¹⁰ Aur")).toEqual({ bayer: "Psi-10", con: "Aur" });
    expect(bayerAbbreviation("τ2 Aqr")).toEqual({ bayer: "Tau-2", con: "Aqr" });
    expect(bayerAbbreviation("β And")).toEqual({ bayer: "Bet", con: "And" });
  });

  it("rejects Latin letters and component letters", () => {
    expect(bayerAbbreviation("d Eri")).toBeNull();
    expect(bayerAbbreviation("o Cet")).toBeNull(); // Latin o
    expect(bayerAbbreviation("θ¹ Ori A")).toBeNull();
    expect(bayerAbbreviation("α Cen A")).toBeNull();
    expect(bayerAbbreviation("Alpha Cen")).toBeNull();
    expect(bayerAbbreviation("")).toBeNull();
  });
});

describe("flamsteedNumber", () => {
  it("reads number and constellation, and nothing else", () => {
    expect(flamsteedNumber("43 And")).toEqual({ number: 43, con: "And" });
    expect(flamsteedNumber("1 CVn")).toEqual({ number: 1, con: "CVn" });
    expect(flamsteedNumber("30 Sgr A")).toBeNull();
    expect(flamsteedNumber("d Eri")).toBeNull();
    expect(flamsteedNumber("0 And")).toBeNull();
  });
});

describe("labelDesignation", () => {
  it("reads an English item label with its own Latin genitive", () => {
    expect(labelDesignation("Beta2 Capricorni")).toEqual({ kind: "bayer", value: "Bet-2", con: "Cap" });
    expect(labelDesignation("Alpha Canum Venaticorum")).toEqual({ kind: "bayer", value: "Alp", con: "CVn" });
    expect(labelDesignation("30 Sagittarii")).toEqual({ kind: "flamsteed", value: 30, con: "Sgr" });
    expect(labelDesignation("Epsilon Boötis")).toEqual({ kind: "bayer", value: "Eps", con: "Boo" });
    expect(labelDesignation("Alpha Centauri A")).toBeNull();
    expect(labelDesignation("Alpha Nowhere")).toBeNull();
  });

  it("knows 88 distinct constellations", () => {
    expect(Object.keys(CONSTELLATION_GENITIVES)).toHaveLength(88);
    expect(new Set(Object.values(CONSTELLATION_GENITIVES)).size).toBe(88);
  });
});

describe("chooseDesignation", () => {
  it("keeps the single candidate in the computed constellation", () => {
    expect(chooseDesignation([{ value: "Bet", con: "And" }], "And")).toEqual({ value: "Bet", decision: "clear" });
  });

  it("resolves a multi-value star by the constellation filter", () => {
    // Wikidata's HIP 677 carries both "α And" and "δ Peg" (a former boundary); the star lies in Andromeda.
    const candidates = [
      { value: "Alp", con: "And" },
      { value: "Del", con: "Peg" },
    ];
    expect(chooseDesignation(candidates, "And")).toEqual({ value: "Alp", decision: "clear" });
    expect(chooseDesignation(candidates, "Peg")).toEqual({ value: "Del", decision: "clear" });
  });

  it("omits a multi-value star the filter cannot resolve", () => {
    const candidates = [
      { value: "Rho", con: "Ari" },
      { value: "Rho-3", con: "Ari" },
    ];
    const result = chooseDesignation(candidates, "Ari");
    expect(result).toEqual({ value: null, decision: "ambiguous", candidates: ["Rho", "Rho-3"] });
  });

  it("omits when no candidate is in the computed constellation, and when there is none", () => {
    expect(chooseDesignation([{ value: 5, con: "Peg" }], "And")).toMatchObject({
      value: null,
      decision: "wrong-constellation",
    });
    expect(chooseDesignation([], "And")).toEqual({ value: null, decision: "none" });
  });

  it("counts the same value twice as one candidate", () => {
    const twice = [
      { value: 21, con: "And" },
      { value: 21, con: "And" },
    ];
    expect(chooseDesignation(twice, "And")).toEqual({ value: 21, decision: "clear" });
  });

  it("lets an override win and carries its source; an override without a source throws", () => {
    const candidates = [
      { value: 43, con: "Ori" },
      { value: 41, con: "Ori" },
    ];
    expect(chooseDesignation(candidates, "Ori", { value: 43, source: "a published catalogue" })).toEqual({
      value: 43,
      decision: "override",
      source: "a published catalogue",
    });
    expect(chooseDesignation(candidates, "Ori", { omit: true, source: "doubtful" })).toEqual({
      value: null,
      decision: "override-omit",
      source: "doubtful",
    });
    expect(() => chooseDesignation(candidates, "Ori", { value: 43, source: " " })).toThrow(/source/);
    expect(() => chooseDesignation(candidates, "Ori", { source: "x" })).toThrow(/value or omit/);
  });
});

describe("validateOverrides", () => {
  it("accepts a value or an omission with a source and rejects the rest", () => {
    expect(() =>
      validateOverrides({ 1: { flamsteed: 43, source: "s" }, 2: { omit: ["bayer"], source: "s" } }),
    ).not.toThrow();
    expect(() => validateOverrides({ 1: { flamsteed: 43 } })).toThrow(/no source/);
    expect(() => validateOverrides({ x: { omit: true, source: "s" } })).toThrow(/not a HIP/);
    expect(() => validateOverrides({ 1: { bayer: "α", source: "s" } })).toThrow(/app's form/);
    expect(() => validateOverrides({ 1: { source: "s" } })).toThrow(/changes nothing/);
  });
});

/** A WGSN-shaped table: the five recorded first columns and a few more, `rows` as [name, hip, bayerId]. */
function wgsnHtml(
  rows,
  headers = ["proper names", "NEC+", "Designation", "HIP", "Bayer ID", "Simbad spelling", "Constellation"],
) {
  const head = `<thead><tr>${headers.map((h) => `<th class=" wdtheader sort "> ${h}</th>`).join("")}</tr></thead>`;
  const body = rows
    .map(
      ([name, hip, bayerId], i) =>
        `<tr id="table_2_row_${i}" data-row-index="${i}"><td style="">${name}</td><td style="">1</td><td style="">HR 1</td><td style="">${hip}</td><td style="">${bayerId}</td><td style=""></td><td style="">Boo</td></tr>`,
    )
    .join("");
  return `<html><body><table id="table_1">${head}<tbody>${body}</tbody></table></body></html>`;
}

describe("parseIauTable", () => {
  const small = { minRows: 2, minWithHip: 1 };

  it("reads names and HIPs, decoding entities and keeping rows without a HIP", () => {
    const html = wgsnHtml([
      ["Izar", "72105", "ε Boo"],
      ["Tupã &amp; Co", "", ""],
      ["Dh&#257;ra", "9", "α Cet"],
    ]);
    expect(parseIauTable(html, small)).toEqual([
      { name: "Izar", hip: 72105, bayerId: "ε Boo" },
      { name: "Tupã & Co", hip: null, bayerId: "" },
      { name: "Dhāra", hip: 9, bayerId: "α Cet" },
    ]);
  });

  it("rejects a table that changed shape", () => {
    const rows = [
      ["Izar", "72105", "ε Boo"],
      ["Vega", "91262", "α Lyr"],
    ];
    // Columns moved.
    expect(() =>
      parseIauTable(wgsnHtml(rows, ["proper names", "NEC+", "Designation", "Bayer ID", "HIP"]), small),
    ).toThrow(/column 4 is "Bayer ID", expected "HIP"/);
    // A row with a different cell count.
    expect(() => parseIauTable(wgsnHtml(rows).replace('<td style="">Boo</td></tr>', "</tr>"), small)).toThrow(/cells/);
    // A HIP that is not a number.
    expect(() => parseIauTable(wgsnHtml([["Izar", "HIP 72105", "ε Boo"], rows[1]]), small)).toThrow(/expected digits/);
    // Not a table at all.
    expect(() => parseIauTable("<html><body>moved</body></html>", small)).toThrow(/no <thead>/);
    // Too few rows for the recorded minimum (600 rows, 500 with a HIP).
    expect(() => parseIauTable(wgsnHtml(rows))).toThrow(/expected at least 600/);
  });
});

describe("namesByHip", () => {
  it("keeps the name without a component letter when two rows share a HIP, and lists the other", () => {
    const { names, dropped } = namesByHip([
      { name: "Pulcherrima", hip: 72105, bayerId: "ε Boo B" },
      { name: "Izar", hip: 72105, bayerId: "ε Boo" },
      { name: "Vega", hip: 91262, bayerId: "α Lyr" },
      { name: "Nebula", hip: null, bayerId: "" },
    ]);
    expect(names.get(72105)).toBe("Izar");
    expect(names.get(91262)).toBe("Vega");
    expect(names.size).toBe(2);
    expect(dropped).toEqual([{ hip: 72105, name: "Pulcherrima", bayerId: "ε Boo B", keptName: "Izar" }]);
  });

  it("throws on a shared HIP it cannot decide and on a name used twice", () => {
    expect(() =>
      namesByHip([
        { name: "A", hip: 1, bayerId: "α Boo" },
        { name: "B", hip: 1, bayerId: "β Boo" },
      ]),
    ).toThrow(/HIP 1/);
    expect(() =>
      namesByHip([
        { name: "Same", hip: 1, bayerId: "" },
        { name: "Same", hip: 2, bayerId: "" },
      ]),
    ).toThrow(/used for HIP 1 and HIP 2/);
  });
});

describe("buildDesignationTables", () => {
  // Synthetic stars: the constellation is a function of the HIP here, standing in for Constellation().
  const conByHip = { 1: "And", 2: "And", 3: "Ori", 4: "Ari", 5: "And", 6: "Sgr" };
  const rows = Object.keys(conByHip).map((hip) => ({ hip: Number(hip), raDeg: Number(hip), decDeg: 0 }));
  const constellationOf = (raHours) => conByHip[Math.round(raHours * 15)];
  const bayer = "http://www.wikidata.org/entity/Q105616";
  const flamsteed = "http://www.wikidata.org/entity/Q111116";
  const binding = (hip, value, catalog) => ({
    hip: { value: `HIP ${hip}` },
    value: { value },
    catalog: { value: catalog },
  });
  const labelBinding = (hip, label) => ({ hip: { value: `HIP ${hip}` }, label: { value: label } });
  const iau = wgsnHtml([
    ["Izar", "1", "ε Boo"],
    ["Vega", "3", "α Lyr"],
  ]);
  const baseInputs = {
    sources: [
      { kind: "designations", name: "Wikidata" },
      { kind: "names", name: "WGSN" },
    ],
    queries: { designations: "q1", labels: "q2" },
    fetchedAt: "2026-01-01T00:00:00.000Z",
  };
  const hipparcos = { sha256: "abc", bytes: 1, rows: 1 };
  const run = (overrides = {}) =>
    buildDesignationTables({
      rows,
      constellationOf,
      designationBindings: [
        binding(1, "α And", bayer), // clear
        binding(1, "δ Peg", bayer), // former constellation, filtered out
        binding(1, "21 And", flamsteed),
        binding(2, "d Eri", bayer), // Latin letter, rejected
        binding(2, "θ¹ Ori A", bayer), // component letter, rejected
        binding(3, "43 Ori", flamsteed),
        binding(3, "41 Ori", flamsteed), // two values in the computed constellation: omitted
        binding(4, "ρ Ari", bayer),
        binding(4, "ρ³ Ari", bayer), // omitted
      ],
      labelBindings: [
        labelBinding(5, "Beta2 Andromedae"), // no catalogue-code value at all: the label is used
        labelBinding(1, "Alpha2 Andromedae"), // the item has a Bayer value already: ignored
        labelBinding(6, "30 Sagittarii"),
      ],
      overrides,
      wgsnHtml: iau,
      inputs: baseInputs,
      hipparcos,
      iauLimits: { minRows: 2, minWithHip: 2 },
    });

  it("applies the rules, reports every omission and is identical on a second run", () => {
    const { starsText, summary } = run();
    expect(summary.stars).toEqual([
      [1, "Alp", 21],
      [5, "Bet-2", null],
      [6, null, 30],
    ]);
    expect(summary.omitted.map((o) => [o.hip, o.kind, o.decision])).toEqual([
      [3, "flamsteed", "ambiguous"],
      [4, "bayer", "ambiguous"],
    ]);
    expect(summary.counts).toMatchObject({ designated: 3, bayer: 2, flamsteed: 2, both: 1 });
    expect(summary.counts.fromLabelFallback).toEqual({ bayer: 1, flamsteed: 1 });
    expect(summary.counts.rejectedWikidataValues).toEqual({ "latin-letter": 1, component: 1, unrecognised: 0 });
    expect(starsText).toBe(run().starsText);
    // One entry per line, keys ascending, valid JSON.
    expect(starsText).toContain('\n    "1": ["Alp",21],\n    "5": ["Bet-2",null],\n    "6": [null,30]\n');
    expect(Object.keys(JSON.parse(starsText).stars)).toEqual(["1", "5", "6"]);
  });

  it("writes the names table keyed by HIP", () => {
    const { namesText } = run();
    expect(JSON.parse(namesText).names).toEqual({ 1: "Izar", 3: "Vega" });
    expect(JSON.parse(namesText).meta.counts).toMatchObject({ hips: 2, withinHipparcosVmag7_5: 2 });
  });

  it("lets an override settle an omitted star, with its source recorded", () => {
    const source = "a published catalogue";
    const { summary, starsText } = run({ 3: { flamsteed: 43, source }, 4: { omit: ["bayer"], source } });
    expect(summary.stars).toContainEqual([3, null, 43]);
    expect(summary.stars.some((s) => s[0] === 4)).toBe(false);
    expect(summary.omitted).toEqual([]);
    expect(JSON.parse(starsText).meta.overridesApplied.map((o) => [o.hip, o.decision, o.source])).toEqual([
      [3, "override", source],
      [4, "override-omit", source],
    ]);
  });

  it("throws for an override on a star that is not in the Hipparcos rows", () => {
    expect(() => run({ 999: { omit: true, source: "x" } })).toThrow(/HIP 999/);
  });
});

// The overrides reach the table only when `npm run stars:designations` runs (it needs the network), so a hand edit of
// the overrides file that is not followed by a regeneration would change nothing and, without this, go unnoticed.
describe("the committed designation table against the overrides file", () => {
  const read = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
  const overrides = read("star-designation-overrides.json");
  const table = read("star-designations.json");

  const expected = Object.entries(overrides)
    .flatMap(([hip, entry]) =>
      ["bayer", "flamsteed"].flatMap((kind) => {
        const override = overrideFor(entry, kind);
        if (override === undefined) {
          return [];
        }
        return [
          {
            hip: Number(hip),
            kind,
            decision: override.omit ? "override-omit" : "override",
            value: override.omit ? null : override.value,
            source: override.source,
          },
        ];
      }),
    )
    .sort((a, b) => a.hip - b.hip || a.kind.localeCompare(b.kind));

  it("records every override of the file, with its decision, value and source, and nothing else", () => {
    const applied = [...table.meta.overridesApplied].sort((a, b) => a.hip - b.hip || a.kind.localeCompare(b.kind));
    expect(applied).toEqual(expected);
    expect(table.meta.counts.overrides).toBe(Object.keys(overrides).length);
  });

  it("holds each overridden value, or none where the override omits it", () => {
    for (const { hip, kind, value } of expected) {
      const tuple = table.stars[String(hip)] ?? [null, null];
      expect(tuple[kind === "bayer" ? 0 : 1], `HIP ${hip} ${kind}`).toBe(value);
    }
  });
});
