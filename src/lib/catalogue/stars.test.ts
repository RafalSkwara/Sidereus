import { describe, expect, it } from "vitest";

import rawStars from "./bright-stars.json";
import meta from "./bright-stars.meta.json";
import finderMeta from "./finder-stars.meta.json";
import { BRIGHT_STARS, BRIGHT_STAR_COUNT_RANGE, BRIGHT_STAR_MAX_MAG } from "./stars";
import { STAR_NAMES, starName } from "./star-names";

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

/**
 * Independent published positions, ICRS J2000 (epoch 2000.0, proper motion applied), as decimal degrees.
 *
 * Read from SIMBAD's TAP service (the `basic` table: `ra`, `dec`, `pmra`, `pmdec`), accessed 2026-10-17, one query per
 * star, for example
 * https://simbad.cds.unistra.fr/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=SELECT%20ra,dec,pmra,pmdec%20FROM%20basic%20JOIN%20ident%20ON%20oidref=oid%20WHERE%20id=%27*%20alf%20CMa%27
 * (SIMBAD's coordinate source for all six is the Hipparcos re-reduction, 2007A&A...474..653V: it checks our reader and
 * the epoch propagation against a published J2000 position, not against astrometry independent of Hipparcos; VizieR's
 * TAP, which would have given a Gaia DR3 cross-read, answered 503 that day).
 *
 * `mag` is the star's Hipparcos V magnitude, only to pick the star out of its neighbours (SIMBAD's V differs by at
 * most 0.03, inside the 0.05 the test allows). `pmMasPerYear` is the proper motion (pmRA*cos(dec), pmDE) as SIMBAD
 * publishes it, for the propagation check below.
 */
const REFERENCES = [
  { name: "Sirius", ra: 101.2871553, dec: -16.7161159, mag: -1.44, pmMasPerYear: [-546.01, -1223.07] },
  { name: "Arcturus", ra: 213.9153003, dec: 19.1824092, mag: -0.05, pmMasPerYear: [-1093.39, -2000.06] },
  { name: "Vega", ra: 279.2347348, dec: 38.783689, mag: 0.03, pmMasPerYear: [200.94, 286.23] },
  { name: "Procyon", ra: 114.8254979, dec: 5.2249876, mag: 0.4, pmMasPerYear: [-714.59, -1036.8] },
  { name: "Capella", ra: 79.1723279, dec: 45.9979915, mag: 0.08, pmMasPerYear: [75.25, -426.89] },
  { name: "Betelgeuse", ra: 88.792939, dec: 7.407064, mag: 0.45, pmMasPerYear: [27.54, 11.3] },
] as const;

/**
 * The two naked-eye stars Hipparcos gives no astrometric solution (ICRS J2000, decimal degrees), from the same SIMBAD
 * TAP `basic` table, accessed 2026-10-17 (`id` = `HIP 55203` and `HIP 78727`; SIMBAD's coordinate source for both is
 * 2012yCat.1322....0Z, the UCAC4 catalogue of Zacharias et al.).
 */
const SEXAGESIMAL_REFERENCES = [
  { hip: 55203, name: "Alula Australis (xi UMa)", ra: 169.5455495, dec: 31.5292889, mag: 3.79 },
  { hip: 78727, name: "xi Sco", ra: 241.0922274, dec: -11.3731039, mag: 4.16 },
] as const;

/** The bright file's unit vectors have 5 decimals (about 2 arcseconds); the references must agree within 3. */
const POSITION_TOLERANCE_ARCSEC = 3;
/**
 * These ten stars sit at their J1991.25 position (no proper motion in the file, not propagated) and a binary's
 * catalogue position differs from the published one by an unknown amount; the test checks the star is where it should
 * be to half an arcminute, not to the arcsecond.
 */
const SEXAGESIMAL_TOLERANCE_ARCSEC = 30;

const ARCSEC_PER_RAD = (180 / Math.PI) * 3600;

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

/** The bright star nearest to a published position, with its offset. */
function nearestBright(raDeg: number, decDeg: number) {
  const target = unit(raDeg, decDeg);
  let best = { star: BRIGHT_STARS[0], arcsec: Number.POSITIVE_INFINITY };
  for (const star of BRIGHT_STARS) {
    const arcsec = separationArcsec(target, star.vector);
    if (arcsec < best.arcsec) {
      best = { star, arcsec };
    }
  }
  return best;
}

describe("bright-star catalogue", () => {
  it("holds the naked-eye stars, brightest first, as J2000 unit vectors", () => {
    expect(BRIGHT_STARS.length).toBeGreaterThanOrEqual(BRIGHT_STAR_COUNT_RANGE.min);
    expect(BRIGHT_STARS.length).toBeLessThanOrEqual(BRIGHT_STAR_COUNT_RANGE.max);
    BRIGHT_STARS.forEach((s, i) => {
      expect(s.mag).toBeLessThanOrEqual(BRIGHT_STAR_MAX_MAG);
      expect(Math.abs(Math.hypot(...s.vector) - 1)).toBeLessThanOrEqual(1e-4);
      if (i > 0) {
        const prev = BRIGHT_STARS[i - 1];
        expect(prev.mag < s.mag || (prev.mag === s.mag && prev.id < s.id)).toBe(true);
      }
    });
  });

  it("records the pinned Hipparcos file, its licence and the ESA credit", () => {
    expect(meta.sha256).toBe(PINNED_SHA256);
    expect(meta.file).toBe("I/239/hip_main.dat");
    expect(meta.licence).toBe("CC BY-NC 3.0 IGO");
    expect(meta.attribution).toContain("Credit: ESA");
    expect(meta.attribution).toContain("SP-1200");
    expect(meta.commercialUse).toBe("requires ESA authorisation");
    expect(meta.count).toBe(BRIGHT_STARS.length);
    // The pinned file cannot change: 919 stars with a solution plus the ten positioned from RAhms/DEdms.
    expect(BRIGHT_STARS).toHaveLength(921);
  });

  it("records exactly the fields read from the file", () => {
    expect(meta.fieldsUsed).toEqual(FIELDS_USED);
    // The ESA reply's list: HIP, RAdeg, DEdeg, Vmag, pmRA, pmDE, and RAhms, DEdms for the ten stars.
    expect(meta.fieldsUsed.map((field) => field.name).sort()).toEqual(
      ["DEdeg", "DEdms", "HIP", "RAdeg", "RAhms", "Vmag", "pmDE", "pmRA"].sort(),
    );
  });

  it("keeps the filter text the build's leak check relies on apart from the finder file's", () => {
    // scripts/build-sw.mjs fails the build when the finder meta's `filter` appears in dist/client, which ships this
    // file: so it must be non-empty, differ from this one and appear nowhere in the browser-delivered files.
    expect(meta.filter.length).toBeGreaterThan(0);
    expect(meta.filter).not.toMatch(/Sol/);
    expect(finderMeta.filter.length).toBeGreaterThan(0);
    expect(finderMeta.filter).not.toBe(meta.filter);
    expect(meta.filter).toContain("4.5");
    expect(JSON.stringify(meta)).not.toContain(finderMeta.filter);
    expect(JSON.stringify(rawStars)).not.toContain(finderMeta.filter);
  });

  it("lists exactly the ten stars positioned from RAhms/DEdms, with Alula Australis and xi Sco among them", () => {
    expect(meta.positionFromSexagesimal.hips).toEqual(SEXAGESIMAL_HIPS);
    expect(meta.positionFromSexagesimal.note).toContain("not propagated");
    for (const reference of SEXAGESIMAL_REFERENCES) {
      const star = BRIGHT_STARS.find((s) => s.id === reference.hip);
      expect(star, reference.name).toBeDefined();
      expect(star?.mag, reference.name).toBe(reference.mag);
      const offset = separationArcsec(unit(reference.ra, reference.dec), star?.vector ?? [0, 0, 0]);
      expect(offset, reference.name).toBeLessThanOrEqual(SEXAGESIMAL_TOLERANCE_ARCSEC);
      // The star is found by its published position too, not just by its number.
      expect(nearestBright(reference.ra, reference.dec).star.id, reference.name).toBe(reference.hip);
    }
  });

  it("puts well-known stars at their published J2000 positions", () => {
    for (const reference of REFERENCES) {
      const { star, arcsec } = nearestBright(reference.ra, reference.dec);
      expect(star.name, reference.name).toBe(reference.name);
      expect(Math.abs(star.mag - reference.mag), reference.name).toBeLessThanOrEqual(0.05);
      expect(arcsec, reference.name).toBeLessThanOrEqual(POSITION_TOLERANCE_ARCSEC);
    }
  });

  it("would fail an unpropagated build: the references move far more than the tolerance in 8.75 years", () => {
    // Hipparcos positions are J1991.25; leaving them there would put Arcturus about 20 arcseconds off and Sirius and
    // Procyon about 11, against a tolerance of 3 (Vega, Capella and Betelgeuse move too little to tell).
    const byName = new Map<string, (typeof REFERENCES)[number]>(REFERENCES.map((r) => [r.name, r]));
    for (const name of ["Arcturus", "Sirius", "Procyon"]) {
      const [pmRa, pmDec] = byName.get(name)?.pmMasPerYear ?? [0, 0];
      const shiftArcsec = (Math.hypot(pmRa, pmDec) / 1000) * 8.75;
      expect(shiftArcsec, name).toBeGreaterThan(POSITION_TOLERANCE_ARCSEC * 3);
    }
  });

  it("has no two stars closer than 5 arcseconds", () => {
    // The brightest 921 are stored at 2 arcseconds' resolution: a duplicate row (HYG listed a second Capella 13
    // arcseconds from the first) would show up here. The closest real pair is alpha Centauri A and B, at about 16.
    let closest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < BRIGHT_STARS.length; i++) {
      for (let j = i + 1; j < BRIGHT_STARS.length; j++) {
        const a = BRIGHT_STARS[i].vector;
        const b = BRIGHT_STARS[j].vector;
        const chord = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * ARCSEC_PER_RAD;
        closest = Math.min(closest, chord);
      }
    }
    expect(closest).toBeGreaterThan(5);
  });

  it("names the 40 brightest named stars plus Polaris, each with a Polish form", () => {
    const named = BRIGHT_STARS.flatMap((s) => (s.name === undefined ? [] : [s.name]));
    expect(named).toHaveLength(41);
    expect(named).toContain("Polaris");
    expect(meta.namedCount).toBe(41);
    for (const name of named) {
      // Identical-in-Polish names map to themselves, so a missing entry is always a mistake.
      expect(STAR_NAMES.pl[name], name).toBeDefined();
    }
    expect(starName("Vega", "pl")).toBe("Wega");
    expect(starName("Vega", "en")).toBe("Vega");
    expect(starName("Unlisted", "pl")).toBe("Unlisted");
  });
});
