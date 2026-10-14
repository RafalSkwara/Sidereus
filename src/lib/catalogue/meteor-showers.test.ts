import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sunLongitudeJ2000Deg } from "@/lib/engine/meteors";
import { addDays } from "@/lib/engine/night";
import { en } from "@/i18n/messages/en";
import { pl } from "@/i18n/messages/pl";

import { METEOR_SHOWERS, SHOWER_KEYS } from "./meteor-showers";

/**
 * The shower table is hand-entered facts (see the file's header and `LICENSE-DATA.md`): this test pins its shape,
 * its names in both languages and the one derivation, the peak longitude, which is recomputed here from NASA's
 * peak night recorded beside it. It does not (and cannot) check the radiants and speeds against the IAU MDC: those
 * were read from the MDC's pages and cross-checked by reading when the table was entered.
 */

/** The instant the table's longitudes are derived at: 00:00 UT at the turn from the night's evening date to its morning date. */
function middleOfNight(nasaPeakNight: string): Date {
  return new Date(`${addDays(nasaPeakNight, 1)}T00:00:00Z`);
}

describe("meteor shower table", () => {
  it("lists the eight showers NASA has a page for, once each", () => {
    const keys = METEOR_SHOWERS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([
      "quadrantids",
      "lyrids",
      "etaAquariids",
      "southernDeltaAquariids",
      "perseids",
      "orionids",
      "leonids",
      "geminids",
    ]);
  });

  it("types its keys by SHOWER_KEYS, in the table's order", () => {
    expect(METEOR_SHOWERS.map((s) => s.key)).toEqual([...SHOWER_KEYS]);
  });

  it("has an English and a Polish name, as a title and inside the verdict's sentence, for every shower, and no name without a shower", () => {
    const keys = METEOR_SHOWERS.map((s) => s.key).sort();
    // The names the page reads: `showerName` (the row and the tile) and `showerNameInLine` (the verdict's sentence).
    const tables = {
      "en showerName": en.tonight.events.showerName,
      "en showerNameInLine": en.tonight.events.showerNameInLine,
      "pl showerName": pl.tonight.events.showerName,
      "pl showerNameInLine": pl.tonight.events.showerNameInLine,
    };
    for (const [label, table] of Object.entries(tables)) {
      const names: Readonly<Record<string, string>> = table;
      for (const shower of METEOR_SHOWERS) {
        const name = names[shower.key];
        expect(typeof name === "string" && name.trim().length > 0, `${shower.key} needs a name in ${label}`).toBe(true);
      }
      expect(Object.keys(names).sort(), label).toEqual(keys);
    }
  });

  it("keeps every number in range, with a positive rate and speed", () => {
    for (const s of METEOR_SHOWERS) {
      expect(s.peakSolarLongitudeJ2000Deg, s.key).toBeGreaterThanOrEqual(0);
      expect(s.peakSolarLongitudeJ2000Deg, s.key).toBeLessThan(360);
      expect(s.radiantRaDeg, s.key).toBeGreaterThanOrEqual(0);
      expect(s.radiantRaDeg, s.key).toBeLessThan(360);
      expect(s.radiantDecDeg, s.key).toBeGreaterThanOrEqual(-90);
      expect(s.radiantDecDeg, s.key).toBeLessThanOrEqual(90);
      expect(s.speedKmS, s.key).toBeGreaterThan(0);
      expect(s.rate, s.key).toBeGreaterThan(0);
      expect(s.nasaPeakNight, s.key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("derives each peak longitude from NASA's peak night: within 1 degree of the engine's J2000 longitude, to 0.1 degree when rounded", () => {
    for (const s of METEOR_SHOWERS) {
      const computed = sunLongitudeJ2000Deg(middleOfNight(s.nasaPeakNight));
      expect(Math.abs(s.peakSolarLongitudeJ2000Deg - computed), `${s.key}: ${computed}`).toBeLessThan(1);
      expect(Math.abs(s.peakSolarLongitudeJ2000Deg - computed), `${s.key}: ${computed}`).toBeLessThanOrEqual(
        0.05 + 1e-9,
      );
    }
  });

  it("puts the peaks in the order of the year they fall in, round the Sun", () => {
    const longitudes = METEOR_SHOWERS.map((s) => s.peakSolarLongitudeJ2000Deg);
    // The Quadrantids (283°) come first in the calendar year, then the table runs on from 32° to 262°.
    expect(longitudes[0]).toBeGreaterThan(longitudes[longitudes.length - 1]);
    expect(longitudes.slice(1)).toEqual([...longitudes.slice(1)].sort((a, b) => a - b));
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
