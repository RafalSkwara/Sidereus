import { describe, expect, it } from "vitest";

import { PUBLISHED_V, PUBLISHED_V_TOLERANCE_MAG, type PublishedV } from "@/lib/engine/fixtures/galaxy-v-reference";

import { DEEP_SKY, type DeepSkyObject } from "./index";

/**
 * Risk this file alone protects (openngc-galaxy-magnitudes, GitHub #178): a galaxy that ships a V magnitude no
 * galaxy has (B minus V below 0.2, OpenNGC's HyperLEDA `vt` or B copied into V) dims its own what-to-expect line and
 * its rank one for one. The generator's colour rule is tested by its own helper test; this file checks the shipped
 * data, with a guard that needs no source and an oracle of six published V values.
 */

const GALAXY_COUNT = 68;

/** The 12 galaxies whose V was impossible against their own B before the correction. */
const THE_TWELVE = [
  "M58",
  "M61",
  "M88",
  "M91",
  "M98",
  "M106",
  "IC342",
  "NGC4449",
  "NGC5005",
  "NGC4565",
  "NGC6822",
  "NGC4039",
] as const;

/** The galaxies whose B−V is below 0.2, which no galaxy has. The literal 0.2 appears only here. */
function implausibleGalaxies(objects: readonly DeepSkyObject[]): DeepSkyObject[] {
  return objects.filter((object) => {
    if (object.type !== "galaxy" || object.bMag === null) return false;
    return Math.round((object.bMag - object.vMag) * 100) / 100 < 0.2;
  });
}

/** The reference galaxies whose catalogue V is further than the tolerance from the published V. */
function publishedVGaps(objects: readonly DeepSkyObject[], reference: readonly PublishedV[]): PublishedV[] {
  return reference.filter((entry) => {
    const object = objects.find((candidate) => candidate.id === entry.id);
    if (!object) return true;
    return Math.abs(object.vMag - entry.publishedV) > PUBLISHED_V_TOLERANCE_MAG;
  });
}

function describeColour(object: DeepSkyObject): string {
  return `${object.id} V ${object.vMag} B ${object.bMag}`;
}

describe("galaxy colour in the shipped catalogue", () => {
  it("no galaxy ships a B-V below 0.2", () => {
    const galaxies = DEEP_SKY.filter((object) => object.type === "galaxy");
    expect(galaxies, "the catalogue's galaxy count").toHaveLength(GALAXY_COUNT);

    const offenders = implausibleGalaxies(DEEP_SKY).map(describeColour);
    expect(offenders, `galaxies with an impossible colour (${offenders.length})`).toEqual([]);
  });

  it("the six Messier galaxies sit within the tolerance of their published V", () => {
    expect(PUBLISHED_V, "the published reference").toHaveLength(6);

    const gaps = publishedVGaps(DEEP_SKY, PUBLISHED_V).map((entry) => {
      const catalogueV = DEEP_SKY.find((object) => object.id === entry.id)?.vMag;
      return `${entry.id} catalogue V ${catalogueV} published V ${entry.publishedV}`;
    });
    expect(gaps, `galaxies further than ${PUBLISHED_V_TOLERANCE_MAG} mag from the published V`).toEqual([]);
  });

  // Proves the two checks above name what they find, whatever the generated data is: it runs on an in-memory copy
  // in a fixed state (the generated JSON is never touched) and stays green before and after the correction.
  it("names exactly the planted fault on a doctored in-memory copy", () => {
    const published = new Map(PUBLISHED_V.map((entry) => [entry.id, entry.publishedV]));
    const twelve: ReadonlySet<string> = new Set(THE_TWELVE);

    // Fixed state: the 12 carry V = B (an impossible colour), the six reference galaxies their published V.
    const fixedState: DeepSkyObject[] = DEEP_SKY.map((object) => {
      if (twelve.has(object.id) && object.bMag !== null) return { ...object, vMag: object.bMag };
      return { ...object };
    });
    expect(
      implausibleGalaxies(fixedState)
        .map((object) => object.id)
        .sort(),
    ).toEqual([...THE_TWELVE].sort());

    // Guard: one of the 12 given a plausible V leaves exactly the other 11.
    const oneCorrected = fixedState.map((object) =>
      object.id === "M58" && object.bMag !== null ? { ...object, vMag: object.bMag - 0.9 } : object,
    );
    expect(
      implausibleGalaxies(oneCorrected)
        .map((object) => object.id)
        .sort(),
    ).toEqual(THE_TWELVE.filter((id) => id !== "M58").sort());

    // Oracle: everything at its published V is clean; M106 put back at 9.29 is the one name.
    const atPublished = fixedState.map((object) => {
      const value = published.get(object.id);
      return value === undefined ? object : { ...object, vMag: value };
    });
    expect(publishedVGaps(atPublished, PUBLISHED_V)).toEqual([]);

    const m106Wrong = atPublished.map((object) => (object.id === "M106" ? { ...object, vMag: 9.29 } : object));
    expect(publishedVGaps(m106Wrong, PUBLISHED_V).map((entry) => entry.id)).toEqual(["M106"]);
  });
});
