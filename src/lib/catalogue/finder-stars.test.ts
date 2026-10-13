import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import brightMeta from "./bright-stars.meta.json";
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
        // HYG ids break ties in the generator but are not stored, so the file can only be checked for mag order.
        expect(prev.mag).toBeLessThanOrEqual(s.mag);
      }
    });
  });

  it("records the pinned HYG commit, the licence and the Hipparcos credit", () => {
    expect(meta.commit).toBe(brightMeta.commit);
    expect(meta.url).toBe(brightMeta.url);
    expect(meta.licence).toBe("CC BY-SA 4.0");
    expect(meta.attribution).toContain("Credit: ESA");
    expect(meta.count).toBe(stars.length);
    expect(meta.designatedCount).toBe(stars.filter((s) => s.designation !== null).length);
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
      expect(matches(bright).length, `HYG id ${bright.id}`).toBeGreaterThan(0);
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
        // A Greek abbreviation HYG uses that the table does not know would stay as three Latin letters.
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
