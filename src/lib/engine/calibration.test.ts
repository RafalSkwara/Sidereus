import { beforeAll, describe, expect, it } from "vitest";

import { DEEP_SKY, findDeepSky } from "@/lib/catalogue";
import type { DeepSkyObject } from "@/lib/catalogue";

import { EYEPIECES, TELESCOPE, WARSAW, warsawDarkWindow } from "./fixtures";
import { AF_FALL_LIST, BEGINNER_REFERENCE, BEGINNER_SOURCES } from "./fixtures/beginner-reference";
import { rankObjects } from "./ranking";
import type { Ranking } from "./ranking";

/**
 * Calibration guard for the mixed Messier + Caldwell ranking (deep-sky-beyond-messier, S-03): four
 * seasonal new-Moon nights at Warsaw under a Bortle 5 sky (a −15° dark window), a 150/750 telescope.
 * Two kinds of expectation. The four loose rules guard `MESSIER_RANK_BONUS` against being set so low that
 * Caldwell objects crowd the top, or so high that they never appear. The oracle (testing-ranking-invariants)
 * compares each night's top five with the committed, source-cited beginner reference
 * (`fixtures/beginner-reference.ts`): at least `BEGINNER_OVERLAP_MIN` objects must match. The expectations
 * come from that reference, never from the engine's own output. The opt-in snapshot below is a recording aid,
 * not an oracle: regenerating it changes no assertion. The top ten per night recorded when the guard was
 * written is in `context/archive/2026-10-06-deep-sky-beyond-messier/evidence/calibration.md`.
 */

const BORTLE = 5;
const NIGHTS = ["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"] as const;
type Night = (typeof NIGHTS)[number];
// How many of a night's top five must be in the beginner reference. The user's decision of 2026-10-08,
// chosen after the list was fixed: today every night overlaps in exactly 3.
const BEGINNER_OVERLAP_MIN = 3;

const isMessier = (object: DeepSkyObject): boolean => object.messier !== null;

describe("deep-sky ranking calibration (Warsaw, Bortle 5, 150/750)", () => {
  const rankings = new Map<Night, Ranking<DeepSkyObject, (typeof EYEPIECES)[number]>>();
  beforeAll(() => {
    for (const date of NIGHTS) {
      rankings.set(
        date,
        rankObjects({
          site: WARSAW,
          bortle: BORTLE,
          minAltitudeDeg: 15,
          darkWindow: warsawDarkWindow(date, BORTLE),
          telescope: TELESCOPE,
          eyepieces: EYEPIECES,
          catalogue: DEEP_SKY,
          limit: Number.POSITIVE_INFINITY,
        }),
      );
    }
  });
  // Opt-in: `CALIBRATION_SNAPSHOT=1 npx vitest run src/lib/engine/calibration.test.ts --reporter=verbose` (the default reporter hides console output) prints each night's top ten,
  // the table recorded in evidence/calibration.md. The default run stays silent.
  it.skipIf(process.env.CALIBRATION_SNAPSHOT !== "1")("prints the top ten per night (snapshot)", () => {
    for (const date of NIGHTS) {
      const rows = entriesOn(date)
        .slice(0, 10)
        .map(({ object, score, rankScore }, i) => ({
          rank: i + 1,
          id: object.id,
          label: object.label,
          type: object.type,
          vMag: object.vMag,
          total: score.total,
          rankScore,
        }));
      console.log(`calibration snapshot ${date}\n${JSON.stringify(rows, null, 1)}`);
    }
  });

  const entriesOn = (date: Night) => {
    const ranking = rankings.get(date);
    if (ranking === undefined) {
      throw new Error("beforeAll did not execute");
    }
    return ranking.entries;
  };

  it.each(NIGHTS)("clears at least one Caldwell object on %s", (date) => {
    expect(entriesOn(date).filter((e) => e.object.caldwell !== null).length).toBeGreaterThanOrEqual(1);
  });

  it.each(NIGHTS)("holds at least three Messier objects in the top five on %s", (date) => {
    const top = entriesOn(date).slice(0, 5);
    expect(top).toHaveLength(5);
    expect(top.filter((e) => isMessier(e.object)).length).toBeGreaterThanOrEqual(3);
  });

  it("puts the Double Cluster in the October top ten", () => {
    const ids = entriesOn("2026-10-15")
      .slice(0, 10)
      .map((e) => e.object.id);
    expect(ids).toContain("NGC869");
  });

  it.each(NIGHTS)("never puts a Caldwell galaxy fainter than magnitude 10 in the top five on %s", (date) => {
    for (const { object } of entriesOn(date).slice(0, 5)) {
      if (object.caldwell !== null && object.type === "galaxy") {
        expect(object.vMag).toBeLessThanOrEqual(10);
      }
    }
  });

  it.each(NIGHTS)("shares at least three of its top five with the beginner reference on %s", (date) => {
    const top = entriesOn(date)
      .slice(0, 5)
      .map((e) => e.object.id);
    const reference = new Set(BEGINNER_REFERENCE[date].map((r) => r.id));
    const shared = top.filter((id) => reference.has(id));
    expect(
      shared.length,
      `top five [${top.join(", ")}] shares [${shared.join(", ")}] with the reference; need ${BEGINNER_OVERLAP_MIN}`,
    ).toBeGreaterThanOrEqual(BEGINNER_OVERLAP_MIN);
  });

  it("only names catalogue objects in the beginner reference and the fall list", () => {
    const ids = [...NIGHTS.flatMap((night) => BEGINNER_REFERENCE[night].map((r) => r.id)), ...AF_FALL_LIST];
    expect(ids.filter((id) => findDeepSky(id) === undefined)).toEqual([]);
  });

  it("keeps the counting rule: at least two distinct, known sources per entry, and no id twice in a night", () => {
    const known = new Set<string>(Object.keys(BEGINNER_SOURCES));
    const problems: string[] = [];
    for (const night of NIGHTS) {
      const seenIds = new Set<string>();
      for (const { id, sources } of BEGINNER_REFERENCE[night]) {
        if (seenIds.has(id)) {
          problems.push(`${night}: ${id} is listed twice`);
        }
        seenIds.add(id);
        if (new Set(sources).size < 2) {
          problems.push(`${night}: ${id} has fewer than 2 distinct sources [${sources.join(", ")}]`);
        }
        for (const source of sources) {
          if (!known.has(source)) {
            problems.push(`${night}: ${id} names the unknown source ${source}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
