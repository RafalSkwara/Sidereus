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

describe("the star build", () => {
  const noTables = { designations: new Map(), names: new Map(), constellationOf };

  it("orders, cuts, rounds and packs as the previous generator did, whatever order the rows arrive in or the clock says", () => {
    // Bright file: magnitude, then HIP; the HIP is the id; 4.5 is kept and a hair fainter is not (a float comparison).
    const brightRows = [star(30, 2.0), star(7, 2.0), star(5, 3.1), star(99, -1.4), star(12, 4.5), star(11, 4.51)];
    const bright = buildBrightCatalogue(brightRows, new Map(), SMALL);
    expect(bright.map((s) => s.id)).toEqual([99, 7, 30, 5, 12]);
    expect(bright.map((s) => s.mag)).toEqual([-1.4, 2.0, 2.0, 3.1, 4.5]);

    // Finder file: magnitude tenths, then HIP, so two stars in one tenth are ordered by HIP, not magnitude.
    // The right ascension (10 + HIP degrees) identifies each star in the packed column.
    const tieRows = [star(30, 4.46, 40), star(10, 4.54, 20), star(20, 4.4, 30), star(5, 7.0, 15)];
    const tie = buildFinderCatalogue(tieRows, noTables, SMALL);
    expect(tie.mag).toEqual([
      [44, 1],
      [45, 2],
      [70, 1],
    ]);
    expect(decodeFinder(tie).map((s) => s.raCenti / 100)).toEqual([30, 20, 40, 15]);

    // Tenths are Math.round(Vmag * 10), not toFixed(1): 0.15, 0.35 and 0.85 are binary floats just below the half, and
    // the star files must not drift from the previous generator's limits (nu And and 24 UMa at 4.53 / 4.54 are in 45).
    const cases = [
      [4.45, 45],
      [7.45, 75],
      [-1.44, -14],
      [0.15, 2],
      [0.35, 4],
      [0.85, 9],
    ];
    expect(cases).toHaveLength(6);
    for (const [i, [vmag, tenths]] of cases.entries()) {
      expect(magnitudeTenths(vmag), `case ${i}: ${vmag}`).toBe(tenths);
    }
    const edge = [star(3881, 4.53), star(46977, 4.54), star(1, 4.45)];
    expect(buildFinderCatalogue(edge, noTables, SMALL).mag).toEqual([[45, 3]]);
    expect(buildBrightCatalogue(edge, new Map(), SMALL).map((s) => s.id)).toEqual([1]);

    // Packing: raCenti * 18001 + (decCenti + 9000), a right ascension that rounds to 360 wraps, magnitudes run-length.
    expect(unitVector(6, 0)).toEqual({ x: 0, y: 1, z: 0 });
    const packed = [
      star(1, -1.44, 101.2875, -16.7161),
      star(2, 0.03, 359.999, 89.9999),
      star(3, 0.04, 0, -90),
      star(4, 0.0, 180.004, 0.004),
      star(5, 5.0, 12.346, 6.789),
    ];
    const finder = buildFinderCatalogue(packed, noTables, SMALL);
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

    // A star positioned from RAhms/DEdms is placed like any other, from the position the reader gave it, unpropagated.
    const sexagesimal = star(55203, 3.79, 187.5, -63.0, { pmRa: null, pmDec: null, fromSexagesimal: true });
    const withSexagesimal = [sexagesimal, star(1, 1.0)];
    expect(buildBrightCatalogue(withSexagesimal, new Map(), SMALL).find((s) => s.id === 55203)).toMatchObject(
      unitVector(187.5 / 15, -63.0),
    );
    expect(
      decodeFinder(buildFinderCatalogue(withSexagesimal, noTables, SMALL)).find((s) => s.tenths === 38),
    ).toMatchObject({
      raCenti: 18750,
      decCenti: -6300,
    });

    // The same strings for the same input, in any row order and whatever the clock says.
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
    const build = (input) => ({
      bright: brightJson(buildBrightCatalogue(input, tables.names, SMALL)),
      finder: finderJson(buildFinderCatalogue(input, tables, SMALL)),
    });
    const first = build(rows);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-01-01T00:00:00Z"));
    const later = build([...rows].reverse());
    vi.useRealTimers();
    expect(later).toEqual(first);
  });

  describe("names and designations", () => {
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

    it("names the brightest 40 stars that have an IAU name plus Polaris (refusing any other count), joins [bayer, flamsteed, con, proper] for a star with any of the three, leaves out one the table omitted by policy and refuses a designation it cannot place", () => {
      const bright = buildBrightCatalogue(rows, names, limits);
      const named = bright.filter((s) => s.name !== undefined);
      expect(named).toHaveLength(41);
      expect(named.slice(0, 40).map((s) => s.name)).toEqual(Array.from({ length: 40 }, (_, i) => `Name${i}`));
      expect(named[40]).toMatchObject({ id: 11767, name: "Polaris" });
      // Unnamed stars between the named ones took no place; the 41st to 44th named stars stay anonymous.
      expect(bright.find((s) => s.id === 140)?.name).toBeUndefined();
      expect(bright.find((s) => s.id === 1000)?.name).toBeUndefined();

      // Polaris does not use up one of the 40 places when it is among the brightest.
      const brightPolaris = rows.map((r) => (r.hip === 11767 ? { ...r, vmag: 0.02 } : r));
      const withBrightPolaris = buildBrightCatalogue(brightPolaris, names, limits);
      expect(withBrightPolaris.filter((s) => s.name !== undefined)).toHaveLength(41);
      expect(withBrightPolaris.find((s) => s.id === 139)?.name).toBe("Name39");

      expect(() => buildBrightCatalogue(rows, new Map([...names].filter(([hip]) => hip !== 11767)), limits)).toThrow(
        /HIP 11767 must be a bright star with an IAU name/,
      );
      const fewNames = new Map([...names].filter(([hip]) => hip < 110 || hip === 11767));
      expect(() => buildBrightCatalogue(rows, fewNames, limits)).toThrow(/Expected 41 named stars, got 11/);
      const twins = new Map([
        [1, "Same"],
        [2, "Same"],
        [3, "Other"],
      ]);
      expect(() => buildBrightCatalogue([star(1, 0), star(2, 1), star(3, 2)], twins, SMALL)).toThrow(
        /name "Same" is used for more than one/,
      );

      const joined = [
        star(1, 1.0, 101.2875, -16.7161), // Sirius-like: Bayer, Flamsteed and a name
        star(2, 2.0, 37.95, 89.26), // Polaris-like: only an IAU name
        star(3, 3.0, 88.79, 7.41), // Flamsteed only
        star(4, 4.0, 10, 20), // nothing in either table
        star(5, 5.0, 279.23, 38.78), // Bayer only
        star(6, 6.0, 30, 30), // the table omitted it by policy (several candidates in Wikidata): no invented value
      ];
      const designations = new Map([
        [1, ["Alp", 9]],
        [3, [null, 58]],
        [5, ["Alp", null]],
      ]);
      const proper = new Map([
        [1, "Sirius"],
        [2, "Polaris"],
      ]);
      const finder = buildFinderCatalogue(joined, { designations, names: proper, constellationOf }, SMALL);
      expect(finder.designations).toEqual({
        0: ["Alp", 9, "CMa", "Sirius"],
        1: [null, null, "UMi", "Polaris"],
        2: [null, 58, "Ori", null],
        4: ["Alp", null, "Lyr", null],
      });
      expect(finder.designations[3]).toBeUndefined();
      expect(finder.designations[5]).toBeUndefined();

      expect(() =>
        buildFinderCatalogue(
          [star(1, 1.0)],
          { ...noTables, designations: new Map([[1, ["Alp", null]]]), constellationOf: () => "" },
          SMALL,
        ),
      ).toThrow(/HIP 1 has a designation but no constellation/);
      expect(() =>
        buildFinderCatalogue([star(1, 1.0)], { ...noTables, designations: new Map([[2, ["Alp", null]]]) }, SMALL),
      ).toThrow(/designation table lists HIP 2/);
    });
  });

  it("refuses a wrong catalogue: not the exact 921 bright and 25,723 finder stars, a duplicate HIP, a designated count out of range, a row without a position, a sexagesimal set that is not the expected ten", () => {
    expect(BUILD_LIMITS).toMatchObject({ brightCount: 921, finderCount: 25723, countMargin: 0 });
    expect(BUILD_LIMITS.designatedRange.min).toBeLessThan(3277);
    expect(BUILD_LIMITS.designatedRange.max).toBeGreaterThan(3277);
    expect(() => buildBrightCatalogue([star(1, 1)], new Map())).toThrow(/Expected 921 ± 0 stars at Vmag <= 4.5, got 1/);
    expect(() => buildFinderCatalogue([star(1, 1)], noTables)).toThrow(
      /Expected 25723 ± 0 stars at Vmag <= 7.5, got 1/,
    );

    const three = [star(1, 1), star(2, 2), star(3, 3)];
    expect(buildBrightCatalogue(three, new Map(), { ...SMALL, brightCount: 4, countMargin: 1 })).toHaveLength(3);
    expect(() => buildBrightCatalogue(three, new Map(), { ...SMALL, brightCount: 5, countMargin: 1 })).toThrow(
      /Expected 5 ± 1/,
    );

    expect(() => buildBrightCatalogue([star(1, 1), star(1, 2)], new Map(), SMALL)).toThrow(
      /Duplicate HIP 1 in the bright set/,
    );
    expect(() => buildFinderCatalogue([star(1, 1), star(1, 6)], noTables, SMALL)).toThrow(
      /Duplicate HIP 1 in the finder set/,
    );

    const two = [star(1, 1), star(2, 2)];
    expect(() => buildFinderCatalogue(two, noTables, { ...SMALL, designatedRange: { min: 1, max: 5 } })).toThrow(
      /Expected 1\.\.5 designated finder stars, got 0/,
    );
    const named = {
      ...noTables,
      names: new Map([
        [1, "One"],
        [2, "Two"],
      ]),
    };
    expect(() => buildFinderCatalogue(two, named, { ...SMALL, designatedRange: { min: 0, max: 1 } })).toThrow(/got 2/);

    expect(() => buildBrightCatalogue([star(1, 1, null, 20)], new Map(), SMALL)).toThrow(
      /HIP 1: RAdeg is not a finite number/,
    );
    expect(() => buildBrightCatalogue([star(1.5, 1)], new Map(), SMALL)).toThrow(/no positive integer HIP/);

    const hips = [...BUILD_LIMITS.sexagesimalHips];
    expect(hips, "ten stars positioned from RAhms/DEdms").toHaveLength(10);
    const sexagesimal = hips.map((hip, i) =>
      star(hip, 6 + i * 0.1, 10 + i, 10, { pmRa: null, pmDec: null, fromSexagesimal: true }),
    );
    const base = {
      pin: HIPPARCOS_PIN,
      fieldsUsed: HIPPARCOS_FIELDS_USED,
      bright: [],
      finder: { pos: [] },
      tables: parseTables(tableTexts()),
      namedCount: 0,
      designatedCount: 0,
    };
    const { finderMeta } = buildMetas({ ...base, rows: sexagesimal });
    expect(finderMeta.positionFromSexagesimal.hips).toEqual(hips);
    expect(finderMeta.positionFromSexagesimal.note).toBe("J1991.25, no proper motion, not propagated");
    expect(() => buildMetas({ ...base, rows: sexagesimal.slice(1) })).toThrow(/Stars positioned from RAhms\/DEdms/);
  });

  it("reads the two committed tables, refuses a malformed one, and writes the Hipparcos pin, the CC BY-NC licence, the fields read and the inputs into both metas", () => {
    const tables = parseTables(tableTexts());
    expect(tables.designations.get(5)).toEqual([null, 42]);
    expect(tables.names.get(9)).toBe("Nameg");
    expect(tables.starsMeta.fetchedAt).toBe("2026-01-01T00:00:00.000Z");

    const good = tableTexts();
    const bad = (designations) => ({
      ...good,
      designationsText: JSON.stringify({ meta: JSON.parse(good.designationsText).meta, stars: designations }),
    });
    expect(() => parseTables(bad({ 3: [null, null] }))).toThrow(/with one of them set/);
    expect(() => parseTables(bad({ 3: ["Alpha", null] }))).toThrow(/HIP 3/);
    expect(() => parseTables(bad({ x: ["Alp", null] }))).toThrow(/not a HIP number/);
    expect(() => parseTables({ ...good, namesText: JSON.stringify({ meta: {}, names: { 3: "A" } }) })).toThrow(
      /fetchedAt/,
    );

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
      expect(meta.fieldsUsed).toEqual(HIPPARCOS_FIELDS_USED.map((f) => ({ ...f })));
      expect(meta.inputs.map((i) => i.name)).toEqual(["Wikidata", "IAU Working Group on Star Names (WGSN)"]);
      expect(meta.inputs[0]).toMatchObject({ licence: "CC0 1.0", counts: { designated: 2 } });
      expect(meta.inputs[1].licence).toContain("public domain");
      expect(meta.filter).not.toContain("Sol");
    }
    expect(brightMeta.filter).not.toBe(finderMeta.filter);
    expect(brightMeta).toMatchObject({ count: 2, namedCount: 41 });
    expect(finderMeta).toMatchObject({ count: 3, designatedCount: 3277 });
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
