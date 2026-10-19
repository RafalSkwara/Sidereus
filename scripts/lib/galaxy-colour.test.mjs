// Tests for the galaxy colour rule without the network: galaxies built here, plus a read of the shipped catalogue to
// check that every Hubble string it holds has a group.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colourGroupOf, correctedV, groupMedians, MIN_GALAXY_BV } from "./galaxy-colour.mjs";

/** A galaxy of a Hubble string with a given B-V (V = 12). */
const galaxy = (hubble, bv) => ({ hubble, bMag: Number((12 + bv).toFixed(2)), vMag: 12 });

/** `n` credible galaxies of one Hubble string at the given colours, enough for a group to stand. */
const credible = (hubble, colours) => colours.map((bv) => galaxy(hubble, bv));

/** Three credible galaxies in each of the four groups, so a test can vary one group. */
const base = () => [
  ...credible("E", [0.85, 0.9, 0.95]),
  ...credible("Sb", [0.7, 0.8, 0.9]),
  ...credible("Sc", [0.5, 0.55, 0.6]),
  ...credible("IB", [0.3, 0.4, 0.5]),
];

describe("galaxy colour rule", () => {
  it("classes every Hubble string of the catalogue's 68 galaxies and refuses any other string", () => {
    const read = (name) =>
      JSON.parse(readFileSync(new URL(`../../src/lib/catalogue/${name}`, import.meta.url), "utf8"));
    const galaxies = [...read("messier.json"), ...read("caldwell.json")].filter((o) => o.type === "galaxy");
    expect(galaxies, "the catalogue's galaxies").toHaveLength(68);
    for (const { id, hubble } of galaxies) {
      expect(() => colourGroupOf(hubble), `${id} (${hubble})`).not.toThrow();
    }

    expect(colourGroupOf("E-S0")).toBe("early");
    expect(colourGroupOf("SABb")).toBe("Sa-Sb");
    expect(colourGroupOf("SBbc")).toBe("Sbc-Sc");
    expect(colourGroupOf("SBm")).toBe("late");
    for (const unknown of ["Sx", "Irr", "SBb?", "sb", "", null, undefined]) {
      expect(() => colourGroupOf(unknown), `Hubble ${JSON.stringify(unknown)}`).toThrow(/no colour group/);
    }
    expect(() => colourGroupOf("Sx")).toThrow(/"Sx"/);
  });

  it("takes the median of the credible B-V per group (odd and even counts), rounded to 0.01", () => {
    // Odd counts: the middle value.
    expect(groupMedians(base())).toEqual({
      early: { median: 0.9, count: 3 },
      "Sa-Sb": { median: 0.8, count: 3 },
      "Sbc-Sc": { median: 0.55, count: 3 },
      late: { median: 0.4, count: 3 },
    });

    // Even count: the mean of the two middle values (0.8 and 0.9).
    expect(groupMedians([...base(), galaxy("Sb", 1.0)])["Sa-Sb"]).toEqual({ median: 0.85, count: 4 });
    // The float mean (0.62 + 0.7) / 2 is 0.6599999...; the median is rounded to 0.01.
    const rounded = groupMedians([
      ...base().filter((g) => g.hubble !== "Sb"),
      ...credible("Sb", [0.61, 0.62, 0.7, 0.9]),
    ]);
    expect(rounded["Sa-Sb"]).toEqual({ median: 0.66, count: 4 });
  });

  it("counts B-V of exactly 0.2 as credible and ignores a lower one and a galaxy without both magnitudes", () => {
    expect(MIN_GALAXY_BV).toBe(0.2);
    const withBoundary = groupMedians([...base().filter((g) => g.hubble !== "IB"), ...credible("IB", [0.2, 0.3, 0.4])]);
    expect(withBoundary.late).toEqual({ median: 0.3, count: 3 });

    const noise = [
      galaxy("IB", 0.19),
      galaxy("IB", -0.5),
      { hubble: "IB", bMag: 10, vMag: null },
      { hubble: "IB", bMag: null, vMag: 9 },
    ];
    expect(groupMedians([...base(), ...noise]).late).toEqual({ median: 0.4, count: 3 });
  });

  it("throws on a thin group and on a credible galaxy of an unknown Hubble type", () => {
    const thin = base().filter((g) => g.hubble !== "IB");
    expect(() => groupMedians([...thin, ...credible("IB", [0.3, 0.4])])).toThrow(/late has 2 credible galaxies/);
    // A galaxy below the floor does not count towards the minimum.
    expect(() => groupMedians([...thin, ...credible("IB", [0.3, 0.4]), galaxy("IB", 0.1)])).toThrow(/late has 2/);
    expect(() => groupMedians([...base(), galaxy("Sx", 0.6)])).toThrow(/"Sx"/);
  });

  it("makes the corrected V brighter than B (a smaller number) for a positive median and rounds it to 0.01", () => {
    // B is the fainter band for any real galaxy (B-V > 0), so V = B - median is a smaller magnitude than B.
    const b = 10.44;
    for (const median of [0.47, 0.55, 0.8, 0.9]) {
      expect(correctedV(b, median), `median ${median}`).toBeLessThan(b);
      expect(b - correctedV(b, median), `median ${median}`).toBeCloseTo(median, 2);
    }
    expect(correctedV(10.44, 0.81)).toBe(9.63);
    expect(correctedV(9.12, 0.56)).toBe(8.56);
  });
});
