// Tests for the designation rules without the network: strings and tables built here, never copies of Wikidata's
// or the WGSN's data. The transform's determinism on the real responses is checked with `--from-raw` (see
// scripts/build-star-designations.mjs).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildDesignationTables,
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

describe("designation parsers", () => {
  it("reads Bayer, Flamsteed and English item labels, and rejects Latin letters and component letters", () => {
    // Every Greek letter has an abbreviation; the omicron is the Greek one (U+03BF), not the Latin "o".
    expect(Object.keys(GREEK_ABBREVIATIONS)).toHaveLength(24);
    expect(bayerAbbreviation("β And")).toEqual({ bayer: "Bet", con: "And" });
    expect(bayerAbbreviation("ο Cet")).toEqual({ bayer: "Omi", con: "Cet" });
    // A superscript is written -n digit by digit, and the ASCII digit form reads the same.
    expect(bayerAbbreviation("π¹ Ori")).toEqual({ bayer: "Pi-1", con: "Ori" });
    expect(bayerAbbreviation("ψ¹⁰ Aur")).toEqual({ bayer: "Psi-10", con: "Aur" });
    expect(bayerAbbreviation("τ2 Aqr")).toEqual({ bayer: "Tau-2", con: "Aqr" });
    for (const rejected of ["d Eri", "o Cet", "θ¹ Ori A", "α Cen A", "Alpha Cen", ""]) {
      expect(bayerAbbreviation(rejected), `bayer "${rejected}"`).toBeNull();
    }

    expect(flamsteedNumber("43 And")).toEqual({ number: 43, con: "And" });
    for (const rejected of ["30 Sgr A", "d Eri", "0 And"]) {
      expect(flamsteedNumber(rejected), `flamsteed "${rejected}"`).toBeNull();
    }

    // An English item label carries its own Latin genitive.
    expect(labelDesignation("Beta2 Capricorni")).toEqual({ kind: "bayer", value: "Bet-2", con: "Cap" });
    expect(labelDesignation("Alpha Canum Venaticorum")).toEqual({ kind: "bayer", value: "Alp", con: "CVn" });
    expect(labelDesignation("30 Sagittarii")).toEqual({ kind: "flamsteed", value: 30, con: "Sgr" });
    expect(labelDesignation("Alpha Centauri A")).toBeNull();
    expect(labelDesignation("Alpha Nowhere")).toBeNull();
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

describe("the WGSN table", () => {
  const small = { minRows: 2, minWithHip: 1 };
  const rows = [
    ["Izar", "72105", "ε Boo"],
    ["Vega", "91262", "α Lyr"],
  ];

  it("reads names and HIPs (decoding entities, keeping rows without a HIP), refuses a table that changed shape and keeps one name per HIP", () => {
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
    // Columns moved.
    expect(() =>
      parseIauTable(wgsnHtml(rows, ["proper names", "NEC+", "Designation", "Bayer ID", "HIP"]), small),
    ).toThrow(/column 4 is "Bayer ID", expected "HIP"/);
    // A row with a different cell count.
    expect(() => parseIauTable(wgsnHtml(rows).replace('<td style="">Boo</td></tr>', "</tr>"), small)).toThrow(/cells/);
    // A HIP that is not a number.
    expect(() => parseIauTable(wgsnHtml([["Izar", "HIP 72105", "ε Boo"], rows[1]]), small)).toThrow(/expected digits/);
    // Not a table at all, and too few rows for the recorded minimum (600 rows, 500 with a HIP).
    expect(() => parseIauTable("<html><body>moved</body></html>", small)).toThrow(/no <thead>/);
    expect(() => parseIauTable(wgsnHtml(rows))).toThrow(/expected at least 600/);

    // Two rows on one HIP: the name without a component letter is kept and the other is listed.
    const { names, dropped } = namesByHip([
      { name: "Pulcherrima", hip: 72105, bayerId: "ε Boo B" },
      { name: "Izar", hip: 72105, bayerId: "ε Boo" },
      { name: "Vega", hip: 91262, bayerId: "α Lyr" },
      { name: "Nebula", hip: null, bayerId: "" },
    ]);
    expect([...names]).toEqual([
      [72105, "Izar"],
      [91262, "Vega"],
    ]);
    expect(dropped).toEqual([{ hip: 72105, name: "Pulcherrima", bayerId: "ε Boo B", keptName: "Izar" }]);
    // A shared HIP it cannot decide and a name used twice are refused.
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

  it("applies the rules and reports every omission, writes the names table, lets an override settle an omitted star with its source (refusing one without), and is identical on a second run", () => {
    const { starsText, summary, namesText } = run();
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
    expect(Object.keys(JSON.parse(starsText).stars)).toEqual(["1", "5", "6"]);
    expect(JSON.parse(namesText).names).toEqual({ 1: "Izar", 3: "Vega" });

    const source = "a published catalogue";
    const settled = run({ 3: { flamsteed: 43, source }, 4: { omit: ["bayer"], source } });
    expect(settled.summary.stars).toContainEqual([3, null, 43]);
    expect(settled.summary.stars.some((s) => s[0] === 4)).toBe(false);
    expect(settled.summary.omitted).toEqual([]);
    expect(JSON.parse(settled.starsText).meta.overridesApplied.map((o) => [o.hip, o.decision, o.source])).toEqual([
      [3, "override", source],
      [4, "override-omit", source],
    ]);
    expect(() => run({ 999: { omit: true, source: "x" } })).toThrow(/HIP 999/);

    expect(() => validateOverrides({ 1: { flamsteed: 43 } })).toThrow(/no source/);
    expect(() => validateOverrides({ x: { omit: true, source: "s" } })).toThrow(/not a HIP/);
    expect(() => validateOverrides({ 1: { bayer: "α", source: "s" } })).toThrow(/app's form/);
    expect(() => validateOverrides({ 1: { source: "s" } })).toThrow(/changes nothing/);
    expect(() =>
      validateOverrides({ 1: { flamsteed: 43, source: "s" }, 2: { omit: ["bayer"], source: "s" } }),
    ).not.toThrow();

    const candidates = [
      { value: 43, con: "Ori" },
      { value: 41, con: "Ori" },
    ];
    expect(chooseDesignation(candidates, "Ori")).toMatchObject({ value: null, decision: "ambiguous" });
    expect(chooseDesignation(candidates, "Ori", { value: 43, source: "a published catalogue" })).toEqual({
      value: 43,
      decision: "override",
      source: "a published catalogue",
    });
    expect(() => chooseDesignation(candidates, "Ori", { value: 43, source: " " })).toThrow(/source/);
  });
});

// The overrides reach the table only when `npm run stars:designations` runs (it needs the network), so a hand edit of
// the overrides file that is not followed by a regeneration would change nothing and, without this, go unnoticed.
describe("overrides and the committed designation table", () => {
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

  it("records every override of the file with its decision, value and source, and holds each overridden value (none where it omits)", () => {
    expect(expected.length, "the overrides file has entries").toBeGreaterThan(0);
    const applied = [...table.meta.overridesApplied].sort((a, b) => a.hip - b.hip || a.kind.localeCompare(b.kind));
    expect(applied).toEqual(expected);
    expect(table.meta.counts.overrides).toBe(Object.keys(overrides).length);
    for (const { hip, kind, value } of expected) {
      const tuple = table.stars[String(hip)] ?? [null, null];
      expect(tuple[kind === "bayer" ? 0 : 1], `HIP ${hip} ${kind}`).toBe(value);
    }
  });
});
