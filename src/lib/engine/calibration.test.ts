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
 * not an oracle: regenerating it changes no assertion. The October showpieces (M13, M57, M27, M15, M2 in the top half
 * of the cleared list, the list's median) and M13 in the top five on the two short-window nights are the same
 * reference read two ways (evening-showpieces, #21 item 1: a pass shorter than the night but long enough to see is
 * not wasted; brightness and type keep them outside the October top five, owner decision OD-1). The top ten per
 * night recorded when the guard was written is in `context/archive/2026-10-06-deep-sky-beyond-messier/evidence/calibration.md`.
 */

const BORTLE = 5;
const NIGHTS = ["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"] as const;
type Night = (typeof NIGHTS)[number];
// How many of a night's top five must be in the beginner reference. The user's decision of 2026-10-08,
// chosen after the list was fixed: today every night overlaps in exactly 3.
const BEGINNER_OVERLAP_MIN = 3;

// Evening showpieces (evening-showpieces, #21 item 1): the reference names M13, M57, M27, M15 and M2 for an October
// evening and M13 for April and July as well. A pass shorter than the night but long enough to see must not be ranked as
// if it were wasted.
const OCTOBER = "2026-10-15" as const; // also the Double Cluster night below
const OCTOBER_EVENING_PICKS = ["M13", "M57", "M27", "M15", "M2"] as const;
const SHORT_NIGHTS = ["2026-04-15", "2026-07-15"] as const;
const SHOWPIECE = "M13";

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
      // eslint-disable-next-line no-console -- opt-in recording aid (CALIBRATION_SNAPSHOT=1); fixed test nights, no user site.
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

  it("clears at least one Caldwell object on every night", () => {
    expect(NIGHTS, "nights").toHaveLength(4);
    for (const date of NIGHTS) {
      const caldwell = entriesOn(date).filter((e) => e.object.caldwell !== null).length;
      expect(caldwell, `${date}: Caldwell objects cleared`).toBeGreaterThanOrEqual(1);
    }
  });

  it("holds at least three Messier objects in the top five on every night", () => {
    expect(NIGHTS, "nights").toHaveLength(4);
    for (const date of NIGHTS) {
      const top = entriesOn(date).slice(0, 5);
      expect(top, `${date}: top five`).toHaveLength(5);
      const messier = top.filter((e) => isMessier(e.object)).length;
      expect(messier, `${date}: Messier objects in [${top.map((e) => e.object.id).join(", ")}]`).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  it("puts the Double Cluster in the October top ten", () => {
    const ids = entriesOn(OCTOBER)
      .slice(0, 10)
      .map((e) => e.object.id);
    expect(ids).toContain("NGC869");
  });

  // Today no Caldwell galaxy reaches any night's top five, so this is a bound on a bonus set too high, not a count.
  it("never puts a Caldwell galaxy fainter than magnitude 10 in the top five on any night", () => {
    expect(NIGHTS, "nights").toHaveLength(4);
    for (const date of NIGHTS) {
      for (const { object } of entriesOn(date).slice(0, 5)) {
        if (object.caldwell !== null && object.type === "galaxy") {
          expect(object.vMag, `${date}: ${object.id}`).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it("shares at least three of its top five with the beginner reference on every night", () => {
    expect(NIGHTS, "nights").toHaveLength(4);
    for (const date of NIGHTS) {
      const top = entriesOn(date)
        .slice(0, 5)
        .map((e) => e.object.id);
      const reference = new Set(BEGINNER_REFERENCE[date].map((r) => r.id));
      expect(reference.size, `${date}: reference entries`).toBeGreaterThanOrEqual(BEGINNER_OVERLAP_MIN);
      const shared = top.filter((id) => reference.has(id));
      expect(
        shared.length,
        `${date}: top five [${top.join(", ")}] shares [${shared.join(", ")}] with the reference; need ${BEGINNER_OVERLAP_MIN}`,
      ).toBeGreaterThanOrEqual(BEGINNER_OVERLAP_MIN);
    }
  });

  it("ranks the October evening showpieces in the top half of the cleared list (the median)", () => {
    const ids = entriesOn(OCTOBER).map((e) => e.object.id);
    expect(ids.length, "cleared objects on the October night").toBeGreaterThanOrEqual(50);
    for (const id of OCTOBER_EVENING_PICKS) {
      expect(
        BEGINNER_REFERENCE[OCTOBER].some((r) => r.id === id),
        `${id} is not in the ${OCTOBER} reference`,
      ).toBe(true);
      const rank = ids.indexOf(id) + 1;
      expect(rank, `${id} is not on the cleared list`).toBeGreaterThan(0);
      expect(rank, `${id} is #${rank} of ${ids.length}`).toBeLessThanOrEqual(ids.length / 2);
    }
  });

  it("keeps M13 in the top five on the two nights with a short dark window", () => {
    for (const date of SHORT_NIGHTS) {
      expect(
        BEGINNER_REFERENCE[date].some((r) => r.id === SHOWPIECE),
        `${SHOWPIECE} is not in the ${date} reference`,
      ).toBe(true);
      const rank = entriesOn(date).findIndex((e) => e.object.id === SHOWPIECE) + 1;
      expect(rank, `${date}: ${SHOWPIECE} is not on the cleared list`).toBeGreaterThan(0);
      expect(rank, `${date}: ${SHOWPIECE} is #${rank}`).toBeLessThanOrEqual(5);
    }
  });

  it("keeps the reference sound: only catalogue objects, at least two distinct, known sources per entry, and no id twice in a night", () => {
    const known = new Set<string>(Object.keys(BEGINNER_SOURCES));
    const problems: string[] = AF_FALL_LIST.filter((id) => findDeepSky(id) === undefined).map(
      (id) => `the fall list names ${id}, which is not in the catalogue`,
    );
    for (const night of NIGHTS) {
      const seenIds = new Set<string>();
      for (const { id, sources } of BEGINNER_REFERENCE[night]) {
        if (findDeepSky(id) === undefined) {
          problems.push(`${night}: ${id} is not in the catalogue`);
        }
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
