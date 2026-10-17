import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import brightMeta from "./bright-stars.meta.json";
import meta from "./finder-stars.meta.json";
import { loadFinderStars } from "./finder-stars";

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
 * One source, by the owner's decision of 2026-10-17 (the plan asked for two; recorded in plan.md and impl-review.md).
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
    expect(meta.positionFromSexagesimal.hips).toEqual(SEXAGESIMAL_HIPS);
    expect(brightMeta.positionFromSexagesimal).toEqual(meta.positionFromSexagesimal);
  });

  it("puts well-known stars at their published J2000 positions and constellations, within the packing floor", () => {
    expect(REFERENCES).toHaveLength(10);
    expect(SEXAGESIMAL_REFERENCES).toHaveLength(2);
    for (const reference of REFERENCES) {
      const { star, arcsec } = nearestStar(reference.ra, reference.dec, reference.mag);
      expect(arcsec, reference.name).toBeLessThanOrEqual(FINDER_PACKING_FLOOR_ARCSEC);
      expect(star.designation?.con, reference.name).toBe(reference.con);
    }
    for (const reference of SEXAGESIMAL_REFERENCES) {
      const { star, arcsec } = nearestStar(reference.ra, reference.dec, reference.mag);
      expect(arcsec, reference.name).toBeLessThanOrEqual(SEXAGESIMAL_TOLERANCE_ARCSEC);
      expect(star.mag, reference.name).toBe(reference.tenths / 10);
      expect(star.designation?.con, reference.name).toBe(reference.con);
    }
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
