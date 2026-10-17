import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import brightMeta from "./bright-stars.meta.json";
import rawFinder from "./finder-stars.json";
import meta from "./finder-stars.meta.json";
import {
  FINDER_STAR_COUNT_RANGE,
  FINDER_STAR_MAX_MAG,
  formatDesignation,
  loadFinderStars,
  unpackMagnitudes,
  unpackPosition,
} from "./finder-stars";
import { BRIGHT_STARS } from "./stars";

const stars = await loadFinderStars();

/** The SHA-256 of the pinned Hipparcos `hip_main.dat` (I/239), written here as the old HYG commit was. */
const PINNED_SHA256 = "58ceabb104d647160d9437ce6e513a02a036bb4ad9f8879a5a22fd52943616e0";

/** The ten stars at V <= 7.5 with no astrometric solution, positioned from RAhms/DEdms (HIP numbers). */
const SEXAGESIMAL_HIPS = [31067, 31500, 34716, 50572, 52800, 55203, 59273, 78727, 80579, 115125];

/**
 * The fields read from the file, as the generator records them: the ESA reply lists HIP, RAdeg, DEdeg, Vmag, pmRA and
 * pmDE, plus RAhms and DEdms for the ten stars without a solution (`split("|")` indices of `hip_main.dat`).
 */
const FIELDS_USED = [
  { name: "HIP", index: 1 },
  { name: "Vmag", index: 5 },
  { name: "RAdeg", index: 8 },
  { name: "DEdeg", index: 9 },
  { name: "pmRA", index: 12 },
  { name: "pmDE", index: 13 },
  { name: "RAhms", index: 3, onlyWhen: "RAdeg and DEdeg are blank" },
  { name: "DEdms", index: 4, onlyWhen: "RAdeg and DEdeg are blank" },
];

const ARCSEC_PER_RAD = (180 / Math.PI) * 3600;

/**
 * The file packs positions to 0.01 degrees, so a star is at most half a cell diagonal away from its true position:
 * 0.005 * sqrt(2) degrees, 25.46 arcseconds at the equator (less elsewhere); plus 0.1 for the unit-vector arithmetic.
 */
const FINDER_PACKING_FLOOR_ARCSEC = 0.005 * Math.SQRT2 * 3600 + 0.1;

/**
 * Independent published positions, ICRS J2000 (epoch 2000.0, proper motion applied), as degrees.
 *
 * Read from SIMBAD's TAP service (the `basic` table: `ra`, `dec`), accessed 2026-10-17, one query per star, for example
 * https://simbad.cds.unistra.fr/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=SELECT%20ra,dec%20FROM%20basic%20JOIN%20ident%20ON%20oidref=oid%20WHERE%20id=%27*%20alf%20CMa%27
 * (SIMBAD's coordinate source is the Hipparcos re-reduction, 2007A&A...474..653V, except Unukalhai, Gaia, and the two
 * stars below, UCAC4: for the Hipparcos stars this checks our reader and the epoch propagation against a published
 * J2000 position, not against astrometry independent of Hipparcos; VizieR's TAP answered 503 that day).
 *
 * `mag` is the star's V magnitude, only to pick the star out of its neighbours (the finder file stores tenths);
 * `con` is the constellation the star is in. Alpheratz (alpha And, once delta Peg) and Elnath (beta Tau, once gamma
 * Aur) sit on a constellation boundary, which the IAU boundaries of 1930 put in Andromeda and Taurus; Unukalhai is
 * alpha Serpentis (Serpens Caput).
 */
const REFERENCES = [
  { name: "Sirius", ra: 101.2871553, dec: -16.7161159, mag: -1.44, con: "CMa" },
  { name: "Arcturus", ra: 213.9153003, dec: 19.1824092, mag: -0.05, con: "Boo" },
  { name: "Vega", ra: 279.2347348, dec: 38.783689, mag: 0.03, con: "Lyr" },
  { name: "Procyon", ra: 114.8254979, dec: 5.2249876, mag: 0.4, con: "CMi" },
  { name: "Capella", ra: 79.1723279, dec: 45.9979915, mag: 0.08, con: "Aur" },
  { name: "Betelgeuse", ra: 88.792939, dec: 7.407064, mag: 0.45, con: "Ori" },
  { name: "Polaris", ra: 37.9545607, dec: 89.264109, mag: 1.97, con: "UMi" },
  { name: "Unukalhai (alpha Ser)", ra: 236.0669755, dec: 6.4256302, mag: 2.65, con: "Ser" },
  { name: "Alpheratz (alpha And)", ra: 2.0969162, dec: 29.0904311, mag: 2.06, con: "And" },
  { name: "Elnath (beta Tau)", ra: 81.5729713, dec: 28.6074517, mag: 1.65, con: "Tau" },
] as const;

/**
 * The two naked-eye stars with no astrometric solution in the file (ICRS J2000, decimal degrees), from the same SIMBAD
 * TAP table, accessed 2026-10-17 (`id` = `HIP 55203` and `HIP 78727`; coordinate source 2012yCat.1322....0Z, UCAC4).
 */
const SEXAGESIMAL_REFERENCES = [
  { name: "Alula Australis (xi UMa)", ra: 169.5455495, dec: 31.5292889, mag: 3.79, tenths: 38, con: "UMa" },
  { name: "xi Sco", ra: 241.0922274, dec: -11.3731039, mag: 4.16, tenths: 42, con: "Sco" },
] as const;

/** Half an arcminute: these stars sit at their J1991.25 position, unpropagated, and a binary's differs from the published one. */
const SEXAGESIMAL_TOLERANCE_ARCSEC = 30;

function unit(raDeg: number, decDeg: number): [number, number, number] {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/** Angle between two vectors in arcseconds (atan2 of cross and dot, so it stays exact for tiny angles). */
function separationArcsec(a: readonly number[], b: readonly number[]): number {
  const cross = Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
  return Math.atan2(cross, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * ARCSEC_PER_RAD;
}

/** The finder star nearest to a published position among those within 0.15 mag of `mag`, with its offset. */
function nearestStar(raDeg: number, decDeg: number, mag: number) {
  const target = unit(raDeg, decDeg);
  let best: { star: (typeof stars)[number]; arcsec: number } | undefined;
  for (const star of stars) {
    if (Math.abs(star.mag - mag) > 0.15 + 1e-9) {
      continue;
    }
    const arcsec = separationArcsec(target, star.vector);
    if (best === undefined || arcsec < best.arcsec) {
      best = { star, arcsec };
    }
  }
  if (best === undefined) {
    throw new Error(`no finder star within 0.15 mag of ${mag}`);
  }
  return best;
}

describe("finder star catalogue", () => {
  it("holds the stars to magnitude 7.5, brightest first, as J2000 unit vectors", () => {
    expect(stars.length).toBeGreaterThanOrEqual(FINDER_STAR_COUNT_RANGE.min);
    expect(stars.length).toBeLessThanOrEqual(FINDER_STAR_COUNT_RANGE.max);
    stars.forEach((s, i) => {
      expect(s.index).toBe(i);
      expect(s.mag).toBeLessThanOrEqual(FINDER_STAR_MAX_MAG);
      expect(Math.abs(Math.hypot(...s.vector) - 1)).toBeLessThanOrEqual(1e-9);
      if (i > 0) {
        const prev = stars[i - 1];
        // HIP numbers break ties in the generator but are not stored, so the file can only be checked for mag order.
        expect(prev.mag).toBeLessThanOrEqual(s.mag);
      }
    });
  });

  it("records the pinned Hipparcos file, its licence and the ESA credit", () => {
    expect(meta.sha256).toBe(PINNED_SHA256);
    expect(meta.sha256).toBe(brightMeta.sha256);
    expect(meta.url).toBe(brightMeta.url);
    expect(meta.file).toBe("I/239/hip_main.dat");
    expect(meta.licence).toBe("CC BY-NC 3.0 IGO");
    expect(meta.attribution).toContain("Credit: ESA");
    expect(meta.attribution).toContain("SP-1200");
    expect(meta.commercialUse).toBe("requires ESA authorisation");
    expect(meta.count).toBe(stars.length);
    // The pinned file cannot change: 25,713 stars with a solution plus the ten positioned from RAhms/DEdms.
    expect(stars).toHaveLength(25723);
    expect(meta.designatedCount).toBe(stars.filter((s) => s.designation !== null).length);
  });

  it("records exactly the fields read from the file, the same as the bright file", () => {
    expect(meta.fieldsUsed).toEqual(FIELDS_USED);
    expect(meta.fieldsUsed).toEqual(brightMeta.fieldsUsed);
    // The ESA reply's list: HIP, RAdeg, DEdeg, Vmag, pmRA, pmDE, and RAhms, DEdms for the ten stars.
    expect(meta.fieldsUsed.map((field) => field.name).sort()).toEqual(
      ["DEdeg", "DEdms", "HIP", "RAdeg", "RAhms", "Vmag", "pmDE", "pmRA"].sort(),
    );
  });

  it("keeps the filter text the build's leak check relies on non-empty and apart from the bright file's", () => {
    // scripts/build-sw.mjs fails the build when this `filter` appears in dist/client, which ships the bright pair:
    // so it must be non-empty, differ from the bright one and not appear in it.
    expect(meta.filter.length).toBeGreaterThan(0);
    expect(meta.filter).not.toMatch(/Sol/);
    expect(meta.filter).not.toBe(brightMeta.filter);
    expect(meta.filter).toContain("7.5");
    expect(JSON.stringify(brightMeta)).not.toContain(meta.filter);
    expect(brightMeta.filter).not.toContain(meta.filter);
  });

  it("lists exactly the ten stars positioned from RAhms/DEdms, and has Alula Australis and xi Sco at their positions", () => {
    expect(meta.positionFromSexagesimal.hips).toEqual(SEXAGESIMAL_HIPS);
    expect(brightMeta.positionFromSexagesimal).toEqual(meta.positionFromSexagesimal);
    for (const reference of SEXAGESIMAL_REFERENCES) {
      const { star, arcsec } = nearestStar(reference.ra, reference.dec, reference.mag);
      expect(arcsec, reference.name).toBeLessThanOrEqual(SEXAGESIMAL_TOLERANCE_ARCSEC);
      expect(star.mag, reference.name).toBe(reference.tenths / 10);
      expect(star.designation?.con, reference.name).toBe(reference.con);
    }
  });

  it("puts well-known stars at their published J2000 positions, within the packing floor", () => {
    for (const reference of REFERENCES) {
      const { arcsec } = nearestStar(reference.ra, reference.dec, reference.mag);
      expect(arcsec, reference.name).toBeLessThanOrEqual(FINDER_PACKING_FLOOR_ARCSEC);
    }
  });

  it("pins the constellation of known stars, two of them on a boundary", () => {
    for (const reference of REFERENCES) {
      const { star } = nearestStar(reference.ra, reference.dec, reference.mag);
      expect(star.designation?.con, reference.name).toBe(reference.con);
    }
  });

  it("has plausible designated, Bayer and Flamsteed counts", () => {
    const designations = stars.flatMap((s) => (s.designation === null ? [] : [s.designation]));
    // The generator's own range (scripts/lib/stars-build.mjs) around the 3,277 measured.
    expect(designations.length).toBeGreaterThanOrEqual(3212);
    expect(designations.length).toBeLessThanOrEqual(3342);
    // About 3 % around the measured 1,471 Bayer letters and 2,639 Flamsteed numbers.
    const bayer = designations.filter((d) => d.bayer !== undefined).length;
    const flamsteed = designations.filter((d) => d.flamsteed !== undefined).length;
    expect(bayer).toBeGreaterThanOrEqual(1427);
    expect(bayer).toBeLessThanOrEqual(1515);
    expect(flamsteed).toBeGreaterThanOrEqual(2560);
    expect(flamsteed).toBeLessThanOrEqual(2718);
  });

  it("has no repeated dot: stars that share a packed cell are real close pairs, and there are no more than before", () => {
    // `pos` keeps 0.01 degrees (36 arcseconds), so a 5-arcsecond check is out of reach here (the bright file's test
    // does it at full precision for the 921 brightest). What the packing can show is a star listed twice: two rows in
    // one cell. Hipparcos lists a few real doubles closer than 36 arcseconds as separate entries (32 pairs at the
    // pinned file), and a duplicate row, like HYG's second Capella, would add one.
    const packed = rawFinder.pos.split(",");
    const cells = new Map<string, number[]>();
    packed.forEach((value, index) => cells.set(value, [...(cells.get(value) ?? []), index]));
    const groups = [...cells.values()].filter((indices) => indices.length > 1);
    const sharedPairs = groups.reduce((sum, indices) => sum + (indices.length * (indices.length - 1)) / 2, 0);
    expect(sharedPairs).toBeLessThanOrEqual(33);
    // A shared cell holding two designated stars with the same constellation, Bayer letter and Flamsteed number would
    // be one star twice.
    for (const indices of groups) {
      const labels = indices.flatMap((index) => {
        const designation = stars[index].designation;
        return designation === null ? [] : [JSON.stringify(designation)];
      });
      expect(new Set(labels).size, `cell of stars ${indices.join(", ")}`).toBe(labels.length);
    }
  });

  /** Finder stars within one arcminute (by chord) and 0.05 mag of `bright`, nearest first. */
  function matches(bright: (typeof BRIGHT_STARS)[number]) {
    const oneArcminute = Math.PI / 180 / 60;
    return stars
      .map((star) => ({
        star,
        // A chord, not an acos: the bright file's vectors are rounded to 5 dp, so their norm is only 1 within 1e-5.
        chord: Math.hypot(
          star.vector[0] - bright.vector[0],
          star.vector[1] - bright.vector[1],
          star.vector[2] - bright.vector[2],
        ),
      }))
      .filter(({ star, chord }) => chord <= oneArcminute && Math.abs(star.mag - bright.mag) <= 0.05 + 1e-9)
      .sort((a, b) => a.chord - b.chord);
  }

  it("lists every bright star, by position and magnitude", () => {
    for (const bright of BRIGHT_STARS) {
      expect(matches(bright).length, `Hipparcos number ${bright.id}`).toBeGreaterThan(0);
    }
  });

  it("names the proper-named bright stars with their proper name", () => {
    for (const bright of BRIGHT_STARS) {
      if (bright.name !== undefined) {
        expect(matches(bright)[0]?.star.designation?.proper, bright.name).toBe(bright.name);
      }
    }
  });

  it("loads once and hands every caller the same stars", async () => {
    expect(await loadFinderStars()).toBe(stars);
  });
});

describe("finder star file size", () => {
  /** The generator (scripts/build-stars.mjs) points here: the file ships to the Worker, so it has a gzip budget. */
  const GZIP_BUDGET_BYTES = 160_000;

  it("gzips to under 160,000 bytes", () => {
    const file = readFileSync(fileURLToPath(new URL("./finder-stars.json", import.meta.url)));
    expect(gzipSync(file).length).toBeLessThan(GZIP_BUDGET_BYTES);
  });
});

describe("position packing", () => {
  /** The generator's formula (scripts/build-stars.mjs): raCenti * 18001 + (decCenti + 9000). */
  const pack = (raCenti: number, decCenti: number) => raCenti * 18001 + (decCenti + 9000);

  it("round-trips the edges of the sky", () => {
    for (const [raCenti, decCenti] of [
      [0, -9000],
      [0, 9000],
      [35999, -9000],
      [35999, 9000],
      [0, 0],
      [18000, 1],
    ]) {
      expect(unpackPosition(pack(raCenti, decCenti))).toEqual({ raCenti, decCenti });
    }
    expect(pack(0, -9000)).toBe(0);
    expect(pack(35999, 9000)).toBe(36000 * 18001 - 1);
  });

  it("refuses a value outside the sky", () => {
    expect(() => unpackPosition(-1)).toThrow();
    expect(() => unpackPosition(36000 * 18001)).toThrow();
    expect(() => unpackPosition(1.5)).toThrow();
  });
});

describe("magnitude runs", () => {
  it("expands runs of [tenths, count]", () => {
    expect(
      unpackMagnitudes(
        [
          [-14, 1],
          [0, 2],
          [75, 3],
        ],
        6,
      ),
    ).toEqual([-14, 0, 0, 75, 75, 75]);
  });

  it("refuses runs that do not add up, run backwards or leave the range", () => {
    expect(() => unpackMagnitudes([[0, 2]], 3)).toThrow();
    expect(() => unpackMagnitudes([[0, 4]], 3)).toThrow();
    expect(() =>
      unpackMagnitudes(
        [
          [5, 1],
          [4, 1],
        ],
        2,
      ),
    ).toThrow();
    expect(() => unpackMagnitudes([[76, 1]], 1)).toThrow();
    expect(() =>
      unpackMagnitudes(
        [
          [0, 0],
          [1, 1],
        ],
        1,
      ),
    ).toThrow();
    expect(() => unpackMagnitudes({}, 1)).toThrow();
  });
});

describe("formatDesignation", () => {
  const byProper = (name: string) => stars.find((s) => s.designation?.proper === name)?.designation ?? null;

  it("is null for a star with no designation", () => {
    expect(formatDesignation(null, "en")).toBeNull();
    expect(stars.some((s) => s.designation === null)).toBe(true);
  });

  it("writes a Bayer letter with its constellation", () => {
    expect(formatDesignation({ bayer: "Bet", con: "And" }, "en")).toBe("β And");
    expect(formatDesignation({ bayer: "Omi", flamsteed: 4, con: "Cet" }, "en")).toBe("ο Cet");
  });

  it("writes a component index as a superscript", () => {
    expect(formatDesignation({ bayer: "Pi-1", con: "Ori" }, "en")).toBe("π¹ Ori");
    expect(formatDesignation({ bayer: "Tau-9", con: "Cet" }, "en")).toBe("τ⁹ Cet");
  });

  it("falls back to the Flamsteed number", () => {
    expect(formatDesignation({ flamsteed: 43, con: "And" }, "en")).toBe("43 And");
  });

  it("puts a proper name before the letter, in the locale's form", () => {
    expect(formatDesignation({ bayer: "Bet", flamsteed: 43, con: "And", proper: "Mirach" }, "en")).toBe(
      "Mirach (β And)",
    );
    expect(formatDesignation({ bayer: "Alp", con: "Lyr", proper: "Vega" }, "pl")).toBe("Wega (α Lyr)");
    expect(formatDesignation({ proper: "Unlisted", con: "And" }, "pl")).toBe("Unlisted");
  });

  it("formats the generated catalogue's stars", () => {
    expect(formatDesignation(byProper("Mirach"), "en")).toBe("Mirach (β And)");
    expect(formatDesignation(byProper("Sulafat"), "en")).toBe("Sulafat (γ Lyr)");
    expect(formatDesignation(byProper("Vega"), "pl")).toBe("Wega (α Lyr)");
    expect(formatDesignation(byProper("Sirius"), "pl")).toBe("Syriusz (α CMa)");
  });

  it("reads every designation in the file", () => {
    for (const s of stars) {
      if (s.designation !== null) {
        const label = formatDesignation(s.designation, "en");
        expect(label, `star ${s.index}`).not.toBeNull();
        // A Greek abbreviation the file uses that the table does not know would stay as three Latin letters.
        expect(label, `star ${s.index}`).not.toMatch(
          /(^|\()(Alp|Bet|Gam|Del|Eps|Zet|Eta|The|Iot|Kap|Lam|Mu|Nu|Xi|Omi|Pi|Rho|Sig|Tau|Ups|Phi|Chi|Psi|Ome)(-\d)? /,
        );
      }
    }
  });
});

/** Module specifiers of every static import, re-export and dynamic import in `source`. */
function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)].map((m) => m[1]);
}

/**
 * The file is server-only: parsing it in the browser would ship ~372 KB of JSON to every visitor. No module under
 * `src/components/` (an island may import a helper there), no sky-view module and neither of the catalogue's
 * island-safe entries may import it. scripts/build-sw.mjs backs this up on the built output.
 */
describe("finder-stars import guard", () => {
  const SRC = fileURLToPath(new URL("../../", import.meta.url));

  function walk(dir: string, accept: (name: string) => boolean): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = dir + entry.name;
      if (entry.isDirectory()) {
        return walk(full + "/", accept);
      }
      return accept(entry.name) ? [full] : [];
    });
  }

  const SOURCES = [
    ...walk(SRC + "components/", () => true),
    ...walk(SRC + "lib/sky-view/", () => true),
    SRC + "lib/catalogue/stars.ts",
    SRC + "lib/catalogue/index.ts",
  ];

  it("scans every component module, every sky-view file and the catalogue's browser-safe entries", () => {
    expect(SOURCES.length).toBeGreaterThan(30);
    expect(SOURCES.some((source) => source.endsWith("/TonightSkyView.tsx"))).toBe(true);
    expect(SOURCES.some((source) => source.endsWith("/rotate.ts"))).toBe(true);
    expect(SOURCES.some((source) => source.endsWith("/catalogue/stars.ts"))).toBe(true);
  });

  /**
   * The /design specimens' sample builder reads the real star file, but only from the server-rendered design.astro
   * (dev only); no island imports it. If an island ever does, build-sw.mjs's leak check fails the build.
   */
  const SERVER_ONLY = [SRC + "components/design/finder-samples.ts"];

  it("imports finder-stars from none of them", () => {
    expect(SOURCES).toEqual(expect.arrayContaining(SERVER_ONLY));
    const offenders = SOURCES.filter(
      (source) =>
        !SERVER_ONLY.includes(source) &&
        importSpecifiers(readFileSync(source, "utf8")).some((specifier) => specifier.includes("finder-stars")),
    );
    expect(offenders).toEqual([]);
  });
});
