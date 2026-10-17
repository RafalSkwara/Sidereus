import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sunLongitudeJ2000Deg } from "@/lib/engine/meteors";
import { addDays } from "@/lib/engine/night";

import { METEOR_SHOWERS } from "./meteor-showers";

/**
 * The shower table is hand-entered facts (see the file's header and `LICENSE-DATA.md`): this test pins the one
 * derivation, the peak longitude, which is recomputed here from NASA's peak night recorded beside it, and the
 * licence note. It does not (and cannot) check the radiants and speeds against the IAU MDC: those were read from
 * the MDC's pages and cross-checked by reading when the table was entered.
 */

/** The instant the table's longitudes are derived at: 00:00 UT at the turn from the night's evening date to its morning date. */
function middleOfNight(nasaPeakNight: string): Date {
  return new Date(`${addDays(nasaPeakNight, 1)}T00:00:00Z`);
}

describe("meteor shower table", () => {
  it("derives each peak longitude from NASA's peak night: within 1 degree of the engine's J2000 longitude, to 0.1 degree when rounded", () => {
    expect(METEOR_SHOWERS.length, "the table has its eight NASA showers").toBeGreaterThanOrEqual(8);
    for (const s of METEOR_SHOWERS) {
      const computed = sunLongitudeJ2000Deg(middleOfNight(s.nasaPeakNight));
      expect(Math.abs(s.peakSolarLongitudeJ2000Deg - computed), `${s.key}: ${computed}`).toBeLessThan(1);
      expect(Math.abs(s.peakSolarLongitudeJ2000Deg - computed), `${s.key}: ${computed}`).toBeLessThanOrEqual(
        0.05 + 1e-9,
      );
    }
  });

  it("names its sources and the derivation in the file header and in LICENSE-DATA.md", () => {
    const header = readFileSync(new URL("./meteor-showers.ts", import.meta.url), "utf8").split("export interface")[0];
    for (const needle of ["science.nasa.gov", "ceresiaumdc.ta3.sk", "not taken from any source", "IMO", "Jopek"]) {
      expect(header, needle).toContain(needle);
    }
    const licence = readFileSync(new URL("./LICENSE-DATA.md", import.meta.url), "utf8");
    expect(licence).toContain("## Meteor showers");
    for (const needle of ["meteor-showers.ts", "NASA", "IAU Meteor Data Center", "derived", "no table"]) {
      expect(licence, needle).toContain(needle);
    }
  });
});
