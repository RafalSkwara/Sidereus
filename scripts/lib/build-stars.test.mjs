// Tests for the pure functions of the star build, without the 53 MB download: synthetic stars only (never copies of
// the catalogue). The real file is built by `npm run stars:build`.
import { Constellation } from "astronomy-engine";
import { describe, expect, it, vi } from "vitest";
import { HIPPARCOS_FIELDS_USED, HIPPARCOS_PIN } from "./hipparcos.mjs";
import {
  BUILD_LIMITS,
  brightJson,
  buildBrightCatalogue,
  buildFinderCatalogue,
  buildMetas,
  centiDegrees,
  finderJson,
  magnitudeTenths,
  parseTables,
  POS_DEC_RANGE,
  unitVector,
} from "./stars-build.mjs";

/** Limits for small synthetic sets: no exact counts, three named stars, no always-named star. */
const SMALL = {
  brightCount: null,
  finderCount: null,
  designatedRange: { min: 0, max: 1e9 },
  brightestNamed: 3,
  alwaysNamedHips: [],
  expectedNamed: null,
};

function star(hip, vmag, raDeg = 10, decDeg = 20, extra = {}) {
  return { hip, vmag, raDeg, decDeg, pmRa: 0, pmDec: 0, fromSexagesimal: false, ...extra };
}

const constellationOf = (raHours, decDeg) => Constellation(raHours, decDeg).symbol;

/** Decodes a finder file the way finder-stars.ts reads it. */
function decodeFinder(catalogue) {
  const tenths = catalogue.mag.flatMap(([t, n]) => Array.from({ length: n }, () => t));
  return catalogue.pos.map((packed, index) => ({
    index,
    tenths: tenths[index],
    raCenti: Math.floor(packed / POS_DEC_RANGE),
    decCenti: (packed % POS_DEC_RANGE) - 9000,
  }));
}

describe("ordering and the HIP tie-break", () => {
  it("sorts the bright file by magnitude, then HIP, and uses the HIP number as id", () => {
    const rows = [star(30, 2.0), star(7, 2.0), star(5, 3.1), star(99, -1.4), star(12, 4.5), star(11, 4.51)];
    const bright = buildBrightCatalogue(rows, new Map(), SMALL);
    expect(bright.map((s) => s.id)).toEqual([99, 7, 30, 5, 12]);
    expect(bright.map((s) => s.mag)).toEqual([-1.4, 2.0, 2.0, 3.1, 4.5]);
  });

  it("keeps a star at exactly 4.5 and drops one a hair fainter (a float comparison, not tenths)", () => {
    const bright = buildBrightCatalogue([star(1, 4.5), star(2, 4.51), star(3, 4.54)], new Map(), SMALL);
    expect(bright.map((s) => s.id)).toEqual([1]);
  });

  it("sorts the finder file by magnitude tenths, then HIP, so two stars in one tenth are ordered by HIP, not magnitude", () => {
    // The right ascension (10 + HIP degrees) identifies each star in the packed column.
    const rows = [star(30, 4.46, 40), star(10, 4.54, 20), star(20, 4.4, 30), star(5, 7.0, 15)];
    const finder = buildFinderCatalogue(rows, { designations: new Map(), names: new Map(), constellationOf }, SMALL);
    expect(finder.mag).toEqual([
      [44, 1],
      [45, 2],
      [70, 1],
    ]);
    // HIP 20 (tenths 44), then HIP 10 and HIP 30 (both 45, in HIP order although HIP 30 is the brighter), then HIP 5.
    expect(decodeFinder(finder).map((s) => s.raCenti / 100)).toEqual([30, 20, 40, 15]);
  });

  it("does not depend on the order the rows arrive in", () => {
    const rows = [star(4, 1.0, 40), star(3, 2.0, 30), star(2, 2.0, 20), star(1, 3.0, 10)];
    const tables = { designations: new Map([[3, ["Alp", null]]]), names: new Map([[2, "Nameb"]]), constellationOf };
    const a = buildFinderCatalogue(rows, tables, SMALL);
    const b = buildFinderCatalogue([...rows].reverse(), tables, SMALL);
    expect(finderJson(b)).toBe(finderJson(a));
    expect(brightJson(buildBrightCatalogue([...rows].reverse(), new Map(), SMALL))).toBe(
      brightJson(buildBrightCatalogue(rows, new Map(), SMALL)),
    );
  });
});

describe("magnitude rounding", () => {
  it("stores Math.round(Vmag * 10) as the previous generator did, so an x.x5 star rounds up", () => {
    expect(magnitudeTenths(4.45)).toBe(45);
    expect(magnitudeTenths(4.44)).toBe(44);
    expect(magnitudeTenths(7.45)).toBe(75);
    expect(magnitudeTenths(-1.44)).toBe(-14);
  });

  it("is Math.round(Vmag * 10), not toFixed(1): the two disagree on some x.x5 values, which move the 4.5 and 7.5 limits", () => {
    // 0.15, 0.35 and 0.85 are binary floats just below the half: Math.round(v * 10) gives 2, 4 and 9 where
    // Number(v.toFixed(1)) * 10 would give 1, 3 and 8. The HYG-era generator used Math.round; the star files must not drift.
    expect(magnitudeTenths(0.15)).toBe(2);
    expect(magnitudeTenths(0.35)).toBe(4);
    expect(magnitudeTenths(0.85)).toBe(9);
  });

  it("puts a 4.53 and a 4.54 star (nu And, 24 UMa) in tenths 45 of the finder file but not in the bright file", () => {
    const rows = [star(3881, 4.53), star(46977, 4.54), star(1, 4.45)];
    const finder = buildFinderCatalogue(rows, { designations: new Map(), names: new Map(), constellationOf }, SMALL);
    expect(finder.mag).toEqual([[45, 3]]);
    expect(buildBrightCatalogue(rows, new Map(), SMALL).map((s) => s.id)).toEqual([1]);
  });
});

describe("names in the bright file", () => {
  const names = new Map();
  /** 44 named stars from magnitude 0.0 up in steps of 0.05, interleaved with unnamed stars between them. */
  const rows = [];
  for (let i = 0; i < 44; i++) {
    const hip = 100 + i;
    rows.push(star(hip, i * 0.05, 5 + i));
    names.set(hip, `Name${i}`);
    rows.push(star(1000 + i, i * 0.05 + 0.01, 5 + i));
  }
  rows.push(star(11767, 3.0, 37.95, 89.26));
  names.set(11767, "Polaris");
  const limits = { ...SMALL, brightestNamed: 40, alwaysNamedHips: [11767], expectedNamed: 41 };

  it("names the brightest 40 stars that have an IAU name, plus Polaris, and no others", () => {
    const bright = buildBrightCatalogue(rows, names, limits);
    const named = bright.filter((s) => s.name !== undefined);
    expect(named).toHaveLength(41);
    expect(named.slice(0, 40).map((s) => s.name)).toEqual(Array.from({ length: 40 }, (_, i) => `Name${i}`));
    expect(named[40]).toMatchObject({ id: 11767, name: "Polaris" });
    // Unnamed stars between the named ones took no place; the 41st to 44th named stars stay anonymous.
    expect(bright.find((s) => s.id === 140)?.name).toBeUndefined();
    expect(bright.find((s) => s.id === 1000)?.name).toBeUndefined();
  });

  it("does not let Polaris use up one of the 40 places when it is among the brightest", () => {
    const brightPolaris = rows.map((r) => (r.hip === 11767 ? { ...r, vmag: 0.02 } : r));
    const bright = buildBrightCatalogue(brightPolaris, names, limits);
    expect(bright.filter((s) => s.name !== undefined)).toHaveLength(41);
    expect(bright.find((s) => s.id === 139)?.name).toBe("Name39");
  });

  it("requires Polaris to be a bright star with an IAU name", () => {
    expect(() => buildBrightCatalogue(rows, new Map([...names].filter(([hip]) => hip !== 11767)), limits)).toThrow(
      /HIP 11767 must be a bright star with an IAU name/,
    );
  });

  it("throws when the named count is not 40 plus Polaris", () => {
    const fewNames = new Map([...names].filter(([hip]) => hip < 110 || hip === 11767));
    expect(() => buildBrightCatalogue(rows, fewNames, limits)).toThrow(/Expected 41 named stars, got 11/);
  });

  it("throws when one IAU name would label two bright stars", () => {
    const twins = new Map([
      [1, "Same"],
      [2, "Same"],
      [3, "Other"],
    ]);
    expect(() => buildBrightCatalogue([star(1, 0), star(2, 1), star(3, 2)], twins, SMALL)).toThrow(
      /name "Same" is used for more than one/,
    );
  });

  it("writes the key order id, mag, x, y, z, name and one star per line", () => {
    const text = brightJson(
      buildBrightCatalogue([star(1, 0.5, 90, 0), star(2, 1.5, 0, 0)], new Map([[1, "Alpha"]]), SMALL),
    );
    const lines = text.split("\n");
    expect(lines[0]).toBe("[");
    expect(lines[1]).toBe('  {"id":1,"mag":0.5,"x":0,"y":1,"z":0,"name":"Alpha"},');
    expect(lines[2]).toBe('  {"id":2,"mag":1.5,"x":1,"y":0,"z":0}');
    expect(lines.slice(3)).toEqual(["]", ""]);
  });
});

describe("unit vectors and packing", () => {
  it("takes the unit vector from the propagated RA in hours and the declination, to 5 digits", () => {
    expect(unitVector(6, 0)).toEqual({ x: 0, y: 1, z: 0 });
    const [s] = buildBrightCatalogue([star(1, 1, 45, 30)], new Map(), SMALL);
    expect(s).toMatchObject({ x: 0.61237, y: 0.61237, z: 0.5 });
  });

  it("packs raCenti * 18001 + (decCenti + 9000), wraps a right ascension that rounds to 360 and encodes magnitude runs", () => {
    const rows = [
      star(1, -1.44, 101.2875, -16.7161),
      star(2, 0.03, 359.999, 89.9999),
      star(3, 0.04, 0, -90),
      star(4, 0.0, 180.004, 0.004),
      star(5, 5.0, 12.346, 6.789),
    ];
    const finder = buildFinderCatalogue(rows, { designations: new Map(), names: new Map(), constellationOf }, SMALL);
    // tenths: -14 (HIP 1), 0 (HIP 4), 0 (HIP 2), 0 (HIP 3), 50 (HIP 5)
    expect(finder.mag).toEqual([
      [-14, 1],
      [0, 3],
      [50, 1],
    ]);
    expect(finder.pos).toEqual([
      10129 * POS_DEC_RANGE + (-1672 + 9000),
      0 * POS_DEC_RANGE + (9000 + 9000),
      0 * POS_DEC_RANGE + (-9000 + 9000),
      18000 * POS_DEC_RANGE + (0 + 9000),
      1235 * POS_DEC_RANGE + (679 + 9000),
    ]);
    expect(centiDegrees(359.999, true)).toBe(0);
    expect(centiDegrees(-16.7161, false)).toBe(-1672);
  });

  it("prints pos as one comma-joined string, mag as runs and designations one per line", () => {
    const rows = [star(1, 1.0, 10, 10), star(2, 2.0, 20, 20), star(3, 2.0, 30, 30)];
    const finder = buildFinderCatalogue(
      rows,
      { designations: new Map([[1, ["Alp", null]]]), names: new Map([[3, "Third"]]), constellationOf },
      SMALL,
    );
    const text = finderJson(finder);
    const lines = text.split("\n");
    expect(lines[0]).toBe("{");
    expect(lines[1]).toBe(`  "pos": "${finder.pos.join(",")}",`);
    expect(lines[2]).toBe('  "mag": [[10,1],[20,2]],');
    expect(lines[3]).toBe('  "designations": {');
    expect(lines[4]).toBe(`    "0": ["Alp",null,"${constellationOf(10 / 15, 10)}",null],`);
    expect(lines[5]).toBe(`    "2": [null,null,"${constellationOf(30 / 15, 30)}","Third"]`);
    expect(JSON.parse(text)).toEqual({
      pos: finder.pos.join(","),
      mag: finder.mag,
      designations: finder.designations,
    });
    expect(Object.keys(JSON.parse(text))).toEqual(["pos", "mag", "designations"]);
  });
});

describe("designation join and constellation", () => {
  it("builds [bayer, flamsteed, con, proper] for a star with any of the three and none for the others", () => {
    const rows = [
      star(1, 1.0, 101.2875, -16.7161), // Sirius-like: Bayer, Flamsteed and a name
      star(2, 2.0, 37.95, 89.26), // Polaris-like: only an IAU name, no Bayer, no Flamsteed
      star(3, 3.0, 88.79, 7.41), // Flamsteed only
      star(4, 4.0, 10, 20), // nothing in either table
      star(5, 5.0, 279.23, 38.78), // Bayer only
    ];
    const designations = new Map([
      [1, ["Alp", 9]],
      [3, [null, 58]],
      [5, ["Alp", null]],
    ]);
    const names = new Map([
      [1, "Sirius"],
      [2, "Polaris"],
    ]);
    const finder = buildFinderCatalogue(rows, { designations, names, constellationOf }, SMALL);
    expect(finder.designations).toEqual({
      0: ["Alp", 9, "CMa", "Sirius"],
      1: [null, null, "UMi", "Polaris"],
      2: [null, 58, "Ori", null],
      4: ["Alp", null, "Lyr", null],
    });
    expect(finder.designations[3]).toBeUndefined();
  });

  it("leaves out a star whose designation the table omitted by policy, and keeps its name when it has one", () => {
    // HIP 2 had several candidate values in Wikidata, so the table has no entry for it; the build must not invent one.
    const rows = [star(1, 1.0), star(2, 2.0, 30, 30), star(3, 3.0, 50, 40)];
    const finder = buildFinderCatalogue(
      rows,
      { designations: new Map([[1, ["Bet", null]]]), names: new Map([[3, "Namec"]]), constellationOf },
      SMALL,
    );
    expect(Object.keys(finder.designations)).toEqual(["0", "2"]);
    expect(finder.designations[2]).toEqual([null, null, constellationOf(50 / 15, 40), "Namec"]);
  });

  it("asks Constellation for the propagated J2000 position (hours, degrees) of designated stars only", () => {
    const spy = vi.fn(() => "Ori");
    const rows = [star(1, 1.0, 90, -10), star(2, 2.0, 180, 20)];
    buildFinderCatalogue(
      rows,
      { designations: new Map([[1, ["Alp", null]]]), names: new Map(), constellationOf: spy },
      SMALL,
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(6, -10);
  });

  it("really is astronomy-engine's constellation for known positions", () => {
    expect(constellationOf(101.2875 / 15, -16.7161)).toBe("CMa");
    expect(constellationOf(279.2347 / 15, 38.7837)).toBe("Lyr");
    expect(constellationOf(213.9153 / 15, 19.1824)).toBe("Boo");
  });

  it("throws when a designated star has no constellation", () => {
    expect(() =>
      buildFinderCatalogue(
        [star(1, 1.0)],
        { designations: new Map([[1, ["Alp", null]]]), names: new Map(), constellationOf: () => "" },
        SMALL,
      ),
    ).toThrow(/HIP 1 has a designation but no constellation/);
  });

  it("throws when the designation table lists a star the build does not have", () => {
    expect(() =>
      buildFinderCatalogue(
        [star(1, 1.0)],
        { designations: new Map([[2, ["Alp", null]]]), names: new Map(), constellationOf },
        SMALL,
      ),
    ).toThrow(/designation table lists HIP 2/);
  });
});

describe("stars positioned from RAhms/DEdms", () => {
  it("places a sexagesimal star like any other, from the position the reader gave it, unpropagated", () => {
    // J1991.25 position as the reader parses it (no proper motion); the build neither moves nor drops it.
    const sexagesimal = star(55203, 3.79, 187.5, -63.0, { pmRa: null, pmDec: null, fromSexagesimal: true });
    const rows = [sexagesimal, star(1, 1.0)];
    const bright = buildBrightCatalogue(rows, new Map(), SMALL);
    expect(bright.find((s) => s.id === 55203)).toMatchObject(unitVector(187.5 / 15, -63.0));
    const finder = buildFinderCatalogue(rows, { designations: new Map(), names: new Map(), constellationOf }, SMALL);
    expect(decodeFinder(finder).find((s) => s.tenths === 38)).toMatchObject({ raCenti: 18750, decCenti: -6300 });
  });

  it("lists the stars with fromSexagesimal in the meta, and refuses a set that is not the expected ten", () => {
    const hips = [...BUILD_LIMITS.sexagesimalHips];
    const rows = hips.map((hip, i) =>
      star(hip, 6 + i * 0.1, 10 + i, 10, { pmRa: null, pmDec: null, fromSexagesimal: true }),
    );
    const tables = parseTables(tableTexts());
    const base = { pin: HIPPARCOS_PIN, fieldsUsed: HIPPARCOS_FIELDS_USED, bright: [], finder: { pos: [] }, tables };
    const { finderMeta } = buildMetas({ ...base, rows, namedCount: 0, designatedCount: 0 });
    expect(finderMeta.positionFromSexagesimal.hips).toEqual(hips);
    expect(finderMeta.positionFromSexagesimal.vmag).toHaveLength(10);
    expect(finderMeta.positionFromSexagesimal.note).toBe("J1991.25, no proper motion, not propagated");
    expect(() => buildMetas({ ...base, rows: rows.slice(1), namedCount: 0, designatedCount: 0 })).toThrow(
      /Stars positioned from RAhms\/DEdms/,
    );
  });
});

describe("guards", () => {
  const empty = { designations: new Map(), names: new Map(), constellationOf };

  it("holds the real counts exactly: 921 bright and 25,723 finder stars, designated count in a measured range", () => {
    expect(BUILD_LIMITS).toMatchObject({ brightCount: 921, finderCount: 25723, countMargin: 0 });
    expect(BUILD_LIMITS.designatedRange.min).toBeLessThan(3277);
    expect(BUILD_LIMITS.designatedRange.max).toBeGreaterThan(3277);
    expect(() => buildBrightCatalogue([star(1, 1)], new Map())).toThrow(/Expected 921 ± 0 stars at Vmag <= 4.5, got 1/);
    expect(() => buildFinderCatalogue([star(1, 1)], empty)).toThrow(/Expected 25723 ± 0 stars at Vmag <= 7.5, got 1/);
  });

  it("allows only the margin it is given", () => {
    const rows = [star(1, 1), star(2, 2), star(3, 3)];
    expect(buildBrightCatalogue(rows, new Map(), { ...SMALL, brightCount: 4, countMargin: 1 })).toHaveLength(3);
    expect(() => buildBrightCatalogue(rows, new Map(), { ...SMALL, brightCount: 5, countMargin: 1 })).toThrow(
      /Expected 5 ± 1/,
    );
  });

  it("throws on a duplicate HIP in either set", () => {
    expect(() => buildBrightCatalogue([star(1, 1), star(1, 2)], new Map(), SMALL)).toThrow(
      /Duplicate HIP 1 in the bright set/,
    );
    expect(() => buildFinderCatalogue([star(1, 1), star(1, 6)], empty, SMALL)).toThrow(
      /Duplicate HIP 1 in the finder set/,
    );
  });

  it("throws when the designated count leaves its range", () => {
    const rows = [star(1, 1), star(2, 2)];
    expect(() => buildFinderCatalogue(rows, empty, { ...SMALL, designatedRange: { min: 1, max: 5 } })).toThrow(
      /Expected 1\.\.5 designated finder stars, got 0/,
    );
    const named = {
      ...empty,
      names: new Map([
        [1, "One"],
        [2, "Two"],
      ]),
    };
    expect(() => buildFinderCatalogue(rows, named, { ...SMALL, designatedRange: { min: 0, max: 1 } })).toThrow(/got 2/);
  });

  it("refuses a row without a position or HIP", () => {
    expect(() => buildBrightCatalogue([star(1, 1, null, 20)], new Map(), SMALL)).toThrow(
      /HIP 1: RAdeg is not a finite number/,
    );
    expect(() => buildBrightCatalogue([star(1.5, 1)], new Map(), SMALL)).toThrow(/no positive integer HIP/);
  });
});

describe("determinism", () => {
  it("gives identical strings for the same input twice, and writes nothing that depends on the clock", () => {
    const rows = [star(5, 4.45, 12, 13), star(4, 1.0, 40), star(3, 2.0, 30), star(2, 2.0, 20), star(1, 7.4, 10)];
    const tables = {
      designations: new Map([[3, ["Alp", 12]]]),
      names: new Map([
        [2, "Nameb"],
        [4, "Named"],
        [5, "Namee"],
      ]),
      constellationOf,
    };
    const build = () => ({
      bright: brightJson(buildBrightCatalogue(rows, tables.names, SMALL)),
      finder: finderJson(buildFinderCatalogue(rows, tables, SMALL)),
    });
    const first = build();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-01-01T00:00:00Z"));
    const second = build();
    vi.useRealTimers();
    expect(second).toEqual(first);
  });
});

function tableTexts() {
  return {
    designationsText: JSON.stringify({
      meta: { fetchedAt: "2026-01-01T00:00:00.000Z", counts: { designated: 2 } },
      stars: { 3: ["Alp", null], 5: [null, 42] },
    }),
    namesText: JSON.stringify({
      meta: { fetchedAt: "2026-01-01T00:00:00.000Z", counts: { hips: 2 } },
      names: { 3: "Namec", 9: "Nameg" },
    }),
  };
}

describe("tables and meta", () => {
  it("reads the two committed tables into maps", () => {
    const tables = parseTables(tableTexts());
    expect(tables.designations.get(3)).toEqual(["Alp", null]);
    expect(tables.designations.get(5)).toEqual([null, 42]);
    expect(tables.names.get(9)).toBe("Nameg");
    expect(tables.starsMeta.fetchedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rejects a malformed table entry or a meta without its provenance", () => {
    const good = tableTexts();
    const bad = (designations) => ({
      ...good,
      designationsText: JSON.stringify({ meta: JSON.parse(good.designationsText).meta, stars: designations }),
    });
    expect(() => parseTables(bad({ 3: [null, null] }))).toThrow(/with one of them set/);
    expect(() => parseTables(bad({ 3: ["Alpha", null] }))).toThrow(/HIP 3/);
    expect(() => parseTables(bad({ 3: ["Alp", 0] }))).toThrow(/HIP 3/);
    expect(() => parseTables(bad({ x: ["Alp", null] }))).toThrow(/not a HIP number/);
    expect(() => parseTables({ ...good, namesText: JSON.stringify({ meta: {}, names: { 3: "A" } }) })).toThrow(
      /fetchedAt/,
    );
    expect(() =>
      parseTables({ ...good, namesText: JSON.stringify({ meta: JSON.parse(good.namesText).meta, names: { 3: " " } }) }),
    ).toThrow(/non-empty name/);
  });

  it("writes provenance into both metas: pin, licence, fields read, distinct filters and the inputs", () => {
    const tables = parseTables(tableTexts());
    const rows = BUILD_LIMITS.sexagesimalHips.map((hip, i) =>
      star(hip, 6 + i * 0.1, 10 + i, 10, { fromSexagesimal: true }),
    );
    const { brightMeta, finderMeta } = buildMetas({
      pin: HIPPARCOS_PIN,
      fieldsUsed: HIPPARCOS_FIELDS_USED,
      rows,
      bright: [{}, {}],
      finder: { pos: [1, 2, 3] },
      tables,
      namedCount: 41,
      designatedCount: 3277,
    });
    for (const meta of [brightMeta, finderMeta]) {
      expect(meta).toMatchObject({
        source: "https://www.cosmos.esa.int/web/hipparcos/catalogues",
        url: HIPPARCOS_PIN.url,
        mirror: HIPPARCOS_PIN.mirror,
        file: "I/239/hip_main.dat",
        sha256: HIPPARCOS_PIN.sha256,
        bytes: 53316318,
        rows: 118218,
        licence: "CC BY-NC 3.0 IGO",
        attribution: "Credit: ESA; ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200",
        commercialUse: "requires ESA authorisation",
      });
      expect(meta.epoch).toContain("J1991.25 propagated to J2000");
      expect(meta.fieldsUsed).toEqual(HIPPARCOS_FIELDS_USED.map((f) => ({ ...f })));
      expect(meta.fieldsUsed.map((f) => f.name)).toEqual([
        "HIP",
        "Vmag",
        "RAdeg",
        "DEdeg",
        "pmRA",
        "pmDE",
        "RAhms",
        "DEdms",
      ]);
      expect(meta.inputs.map((i) => i.name)).toEqual(["Wikidata", "IAU Working Group on Star Names (WGSN)"]);
      expect(meta.inputs[0]).toMatchObject({
        licence: "CC0 1.0",
        fetchedAt: "2026-01-01T00:00:00.000Z",
        counts: { designated: 2 },
      });
      expect(meta.inputs[1].licence).toContain("public domain");
      expect(meta.inputs.map((i) => i.table)).toEqual([
        "scripts/data/star-designations.json",
        "scripts/data/iau-star-names.json",
      ]);
      expect(meta.filter).not.toBe("");
      expect(meta.filter).not.toContain("Sol");
    }
    expect(brightMeta.filter).not.toBe(finderMeta.filter);
    expect(brightMeta).toMatchObject({ count: 2, namedCount: 41 });
    expect(finderMeta).toMatchObject({ count: 3, designatedCount: 3277 });
    expect(finderMeta.normalisations.join(" ")).toContain("the file holds no HIP");
  });
});
