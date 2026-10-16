import { beforeAll, describe, expect, it } from "vitest";

import { DEEP_SKY } from "@/lib/catalogue";

import { EYEPIECES, TELESCOPE, WARSAW, warsawDarkWindow } from "./fixtures";
import { BEGINNER_REFERENCE } from "./fixtures/beginner-reference";
import type { ReferenceNight } from "./fixtures/beginner-reference";
import { rankObjects } from "./ranking";

/**
 * Evening showpieces (evening-showpieces, M-4 S-05, #21 item 1). The published beginner reference
 * (`fixtures/beginner-reference.ts`, each entry named by at least two sources) names M13, M57, M27, M15 and M2
 * for an October evening, and M13 for April and July as well. A pass shorter than the night but long enough to
 * see (these objects are up for 5 to 6 hours of a 10 hour October night) must not be ranked as if it were wasted:
 * each of them lies in the top half of the cleared list, and M13 is in the top 5 on the two nights with a short
 * dark window. The cut is the list's median, a natural one, not a number read off the engine. Brightness and type
 * keep them outside the October top 5 (owner decision OD-1): this guard asks no more than the structural
 * penalty's removal. Same setup as `calibration.test.ts`: Warsaw, Bortle 5, a 150/750, the whole catalogue.
 */

const BORTLE = 5;
const OCTOBER: ReferenceNight = "2026-10-15";
const OCTOBER_EVENING_PICKS = ["M13", "M57", "M27", "M15", "M2"] as const;
// M13 is also a reference entry on these two nights.
const SHORT_NIGHTS: readonly ReferenceNight[] = ["2026-04-15", "2026-07-15"];
const SHOWPIECE = "M13";
const TOP = 5;

function rankedIds(date: ReferenceNight): string[] {
  const { entries } = rankObjects({
    site: WARSAW,
    bortle: BORTLE,
    minAltitudeDeg: 15,
    darkWindow: warsawDarkWindow(date, BORTLE),
    telescope: TELESCOPE,
    eyepieces: EYEPIECES,
    catalogue: DEEP_SKY,
    limit: Number.POSITIVE_INFINITY,
  });
  return entries.map((e) => e.object.id);
}

describe("evening showpieces (Warsaw, Bortle 5, 150/750)", () => {
  const ranked = new Map<ReferenceNight, string[]>();
  beforeAll(() => {
    for (const date of [OCTOBER, ...SHORT_NIGHTS]) {
      ranked.set(date, rankedIds(date));
    }
  });
  const idsOn = (date: ReferenceNight): string[] => {
    const ids = ranked.get(date);
    if (ids === undefined) {
      throw new Error("beforeAll did not execute");
    }
    return ids;
  };

  it("takes its picks from the reference, each with at least two sources", () => {
    for (const id of OCTOBER_EVENING_PICKS) {
      const entry = BEGINNER_REFERENCE[OCTOBER].find((r) => r.id === id);
      expect(entry, `${id} is not in the ${OCTOBER} reference`).toBeDefined();
      expect(new Set(entry?.sources).size, `${id} sources`).toBeGreaterThanOrEqual(2);
    }
    for (const date of SHORT_NIGHTS) {
      const entry = BEGINNER_REFERENCE[date].find((r) => r.id === SHOWPIECE);
      expect(entry, `${SHOWPIECE} is not in the ${date} reference`).toBeDefined();
      expect(new Set(entry?.sources).size, `${SHOWPIECE} sources on ${date}`).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(OCTOBER_EVENING_PICKS)("ranks %s in the top half of the cleared list on the October night", (id) => {
    const ids = idsOn(OCTOBER);
    const rank = ids.indexOf(id) + 1;
    expect(rank, `${id} is not on the cleared list`).toBeGreaterThan(0);
    expect(rank, `${id} is #${rank} of ${ids.length}`).toBeLessThanOrEqual(ids.length / 2);
  });

  it.each(SHORT_NIGHTS)("keeps M13 in the top five on %s", (date) => {
    const rank = idsOn(date).indexOf(SHOWPIECE) + 1;
    expect(rank, `${SHOWPIECE} is not on the cleared list`).toBeGreaterThan(0);
    expect(rank, `${SHOWPIECE} is #${rank}`).toBeLessThanOrEqual(TOP);
  });
});
