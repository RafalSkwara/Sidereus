import { beforeAll, describe, expect, it } from "vitest";

import { MESSIER } from "@/lib/catalogue";

import { EYEPIECES, TELESCOPE, WARSAW, warsawDarkWindow } from "./fixtures";
import { AF_FALL_LIST } from "./fixtures/beginner-reference";
import { seenSummaries } from "./log";
import {
  BRIGHTNESS_RAMP_MAG,
  LOG_PENALTY,
  MAX_RANKED_OBJECTS,
  MESSIER_RANK_BONUS,
  MIN_OBJECT_SCORE,
  SCORE_WEIGHTS,
} from "./parameters";
import { rankObjects, reasonComponents } from "./ranking";
import type { RankInput, RankableObject, Ranking } from "./ranking";
import type { ScoreComponents } from "./score";

const BORTLE = 6;

/**
 * A bright, compact cluster at the given declination: it scores near 1 whenever it is up. `M<n>` for a
 * Messier number; pass `id` in the overrides (and `messier: null`) for a non-Messier object.
 */
function synthetic(messier: number, decDeg: number, overrides: Partial<RankableObject> = {}): RankableObject {
  return {
    id: `M${messier}`,
    messier,
    raHours: 0,
    decDeg,
    vMag: 1,
    surfaceBrightness: null,
    type: "open-cluster",
    majorAxisArcmin: 5,
    minorAxisArcmin: null,
    ...overrides,
  };
}

type Eyepiece = (typeof EYEPIECES)[number];

function rank<O extends RankableObject>(
  catalogue: readonly O[],
  overrides: Partial<RankInput<O, Eyepiece>> = {},
): Ranking<O, Eyepiece> {
  return rankObjects<O, Eyepiece>({
    site: WARSAW,
    bortle: BORTLE,
    minAltitudeDeg: 15,
    darkWindow: warsawDarkWindow(),
    telescope: TELESCOPE,
    eyepieces: EYEPIECES,
    catalogue,
    ...overrides,
  });
}

describe("rankObjects (synthetic catalogue, Warsaw 2026-10-10)", () => {
  it("never ranks an object that stays below the minimum altitude through the dark window", () => {
    // δ = −60° never rises at 52° N; δ = +89.9° is circumpolar at about 52°.
    const ranking = rank([synthetic(1, -60), synthetic(2, 89.9)]);
    expect(ranking.entries.map((e) => e.object.messier)).toEqual([2]);
    expect(ranking.clearedCount).toBe(1);
    // A minimum altitude above the pole's altitude ranks nothing at all.
    expect(rank([synthetic(2, 89.9)], { minAltitudeDeg: 60 })).toEqual({
      clearedCount: 0,
      entries: [],
      washedOut: [],
      washedOutCount: 0,
      telescopeId: "t1",
    });
  });

  it("breaks a tie on total by Messier number ascending", () => {
    const ranking = rank([synthetic(7, 89.9), synthetic(3, 89.9), synthetic(5, 89.9)]);
    expect(ranking.entries.map((e) => e.object.messier)).toEqual([3, 5, 7]);
    expect(ranking.entries[0].score.total).toBe(ranking.entries[2].score.total);
  });

  it("breaks a tie between non-Messier objects by id, and puts them after a Messier object", () => {
    const other = (id: string) => synthetic(0, 89.9, { id, messier: null });
    const ranking = rank([other("NGC869"), other("NGC7000"), synthetic(5, 89.9), other("IC405")]);
    // The Messier object leads on the bonus; the rest tie exactly and go by id (code-unit order).
    expect(ranking.entries.map((e) => e.object.id)).toEqual(["M5", "IC405", "NGC7000", "NGC869"]);
    expect(ranking.entries[1].score.total).toBe(ranking.entries[3].score.total);
    expect(ranking.entries[1].rankScore).toBe(ranking.entries[1].score.total);
    expect(ranking.entries[0].rankScore).toBe(ranking.entries[0].score.total + MESSIER_RANK_BONUS);
  });

  it("lets the Messier bonus break a near-tie towards the Messier object", () => {
    // Brightness alone separates them: half a magnitude is about 0.016 of total, below the bonus.
    const other = synthetic(0, 89.9, { id: "NGC7000", messier: null, vMag: 5 });
    const messier = synthetic(5, 89.9, { vMag: 5.5 });
    const ranking = rank([other, messier]);
    const [first, second] = ranking.entries;
    expect(first.object.id).toBe("M5");
    expect(second.object.id).toBe("NGC7000");
    const gap = second.score.total - first.score.total;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(MESSIER_RANK_BONUS);
  });

  it("does not let the bonus overcome a gap larger than itself", () => {
    const other = synthetic(0, 89.9, { id: "NGC7000", messier: null, vMag: 1 });
    const messier = synthetic(5, 89.9, { vMag: 11 });
    expect(rank([messier, other]).entries.map((e) => e.object.id)).toEqual(["NGC7000", "M5"]);
  });

  it("never lifts an object whose own score is below the bar into the list", () => {
    // A low-interest double star on the horizon's edge: dec 0° at vMag 10 just clears the bar, and each
    // further 0.3 mag costs about 0.009, so at 10.3 it falls short by less than MESSIER_RANK_BONUS.
    const faint = (vMag: number): RankableObject =>
      synthetic(40, 0, { vMag, type: "double-star", surfaceBrightness: 22 });
    const [reference] = rank([faint(10)]).entries;
    expect(reference.score.total).toBeGreaterThanOrEqual(MIN_OBJECT_SCORE);
    const shortfall = (0.3 * SCORE_WEIGHTS.brightness) / BRIGHTNESS_RAMP_MAG;
    expect(reference.score.total - shortfall).toBeLessThan(MIN_OBJECT_SCORE);
    expect(reference.score.total - shortfall + MESSIER_RANK_BONUS).toBeGreaterThan(MIN_OBJECT_SCORE);

    const ranking = rank([faint(10.3)], { limit: Number.POSITIVE_INFINITY });
    expect(ranking.clearedCount).toBe(0);
    expect(ranking.entries).toEqual([]);
  });

  it("counts every cleared object but lists at most MAX_RANKED_OBJECTS", () => {
    const catalogue = [8, 1, 6, 3, 7, 2, 5, 4].map((m) => synthetic(m, 89.9));
    const ranking = rank(catalogue);
    expect(ranking.clearedCount).toBe(8);
    expect(ranking.entries).toHaveLength(MAX_RANKED_OBJECTS);
    expect(ranking.entries.map((e) => e.object.messier)).toEqual([1, 2, 3, 4, 5]);
    for (const entry of ranking.entries) {
      expect(entry.score.total).toBeGreaterThanOrEqual(MIN_OBJECT_SCORE);
    }
  });
});

describe("rankObjects (full catalogue, Warsaw 2026-10-10)", () => {
  let ranking: Ranking<(typeof MESSIER)[number], Eyepiece> | null = null;
  beforeAll(() => {
    ranking = rank(MESSIER);
  });
  const get = () => {
    if (ranking === null) {
      throw new Error("beforeAll did not execute");
    }
    return ranking;
  };

  it("lists up to five cleared objects, each above the minimum altitude at its peak", () => {
    const { entries, clearedCount } = get();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThanOrEqual(MAX_RANKED_OBJECTS);
    expect(clearedCount).toBeGreaterThanOrEqual(entries.length);
    for (const entry of entries) {
      expect(entry.peak.altitudeDeg).toBeGreaterThanOrEqual(15);
      expect(entry.score.total).toBeGreaterThanOrEqual(MIN_OBJECT_SCORE);
    }
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1].score.total).toBeGreaterThanOrEqual(entries[i].score.total);
    }
  });

  it("never lists an object that cannot rise above 15° from Warsaw (δ < −22.77°)", () => {
    for (const entry of get().entries) {
      expect(entry.object.decDeg).toBeGreaterThan(15 - (90 - WARSAW.latitudeDeg) - 1);
    }
  });
});

describe("rankObjects with a limit (tonight-all-objects, Warsaw 2026-10-10)", () => {
  it("lists every cleared object with limit Infinity, in the same order as the default top five", () => {
    const top = rank(MESSIER);
    const all = rank(MESSIER, { limit: Number.POSITIVE_INFINITY });
    expect(all.clearedCount).toBe(top.clearedCount);
    expect(all.entries).toHaveLength(all.clearedCount);
    expect(all.clearedCount).toBeGreaterThan(MAX_RANKED_OBJECTS);
    expect(all.entries.slice(0, top.entries.length).map((e) => e.object.messier)).toEqual(
      top.entries.map((e) => e.object.messier),
    );
    for (let i = 1; i < all.entries.length; i++) {
      expect(all.entries[i - 1].rankScore).toBeGreaterThanOrEqual(all.entries[i].rankScore);
    }
  });
});

describe("rankObjects under moonlight (moonlight-and-the-verdict, Warsaw, Bortle 6, 150 mm)", () => {
  const CLUSTER_TYPES: readonly string[] = ["open-cluster", "globular-cluster", "asterism", "double-star"];
  const onNight = (date: string) => rank(MESSIER, { darkWindow: warsawDarkWindow(date) });

  // The top five is checked against source AF (Astronomy.com, "See fall's best Messier objects") as a set, not
  // as the order the engine printed: a harmless reorder passes, a retune that drops a published pick fails.
  it("changes nothing on the new-Moon night of 2026-10-10: nothing washed out, a top five of AF's fall picks with M31", () => {
    const ranking = onNight("2026-10-10");
    expect(ranking.washedOutCount).toBe(0);
    expect(ranking.washedOut).toEqual([]);
    const ids = ranking.entries.map((e) => e.object.id);
    expect(ids).toHaveLength(5);
    for (const id of ids) {
      expect(AF_FALL_LIST, `${id} is not in AF's fall list`).toContain(id);
    }
    // M31 is named by every fall source.
    expect(ids).toContain("M31");
  });

  it("lists only clusters under the full Moon of 2026-10-26, and sets the washed-out galaxies apart", () => {
    const ranking = onNight("2026-10-26");
    for (const entry of ranking.entries) {
      expect(CLUSTER_TYPES).toContain(entry.object.type);
    }
    expect(ranking.washedOutCount).toBeGreaterThanOrEqual(3);
    expect(ranking.washedOutCount).toBe(ranking.washedOut.length);
    const all = rank(MESSIER, { darkWindow: warsawDarkWindow("2026-10-26"), limit: Number.POSITIVE_INFINITY });
    const listedIds = new Set(all.entries.map((e) => e.object.id));
    for (const { object, peak } of ranking.washedOut) {
      expect(listedIds.has(object.id)).toBe(false);
      expect(object.id).not.toBe("M16");
      expect(peak.altitudeDeg).toBeGreaterThanOrEqual(15);
    }
    const times = ranking.washedOut.map((w) => w.peak.time.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe("reasonComponents", () => {
  const c = (duration: number, moon: number, brightness: number, sky: number): ScoreComponents => ({
    duration,
    moon,
    brightness,
    sky,
  });

  it("leads with the weighted component that most sets each entry apart from the listed mean", () => {
    // Binary-exact values, so the means are exact: duration 0.625, moon 0.75, brightness 0.625, sky 0.75.
    const reasons = reasonComponents([c(1, 0.75, 0.25, 0.75), c(0.25, 0.75, 1, 0.75), c(0.625, 0.75, 0.625, 0.75)]);
    // A: duration +0.13125, brightness −0.09375 → duration, then moon (0, before sky).
    expect(reasons[0]).toEqual({ lead: "duration", second: "moon" });
    // B: duration −0.13125, brightness +0.09375 → brightness, then moon.
    expect(reasons[1]).toEqual({ lead: "brightness", second: "moon" });
    // C: every weighted deviation is 0, so it stands out on nothing → fall back to its largest
    // weighted values: moon 0.225, duration 0.21875.
    expect(reasons[2]).toEqual({ lead: "moon", second: "duration" });
  });

  it("weights the deviation, so a smaller weighted gap loses to a bigger one", () => {
    // Sky deviates by ±0.5 (weighted 0.05); moon by ±0.2 (weighted 0.06).
    const reasons = reasonComponents([c(0.5, 0.9, 0.5, 1), c(0.5, 0.5, 0.5, 0)]);
    expect(reasons[0]).toEqual({ lead: "moon", second: "sky" });
    // The second entry is below the mean on moon and sky and level on the rest → the weighted-value
    // fallback: duration 0.175, moon 0.15.
    expect(reasons[1]).toEqual({ lead: "duration", second: "moon" });
  });

  it("falls back to the largest weighted values for an entry that stands out on nothing", () => {
    // The four tops stand out on brightness (above the 0.9 mean), so they lead with it; the weaker
    // entry is level on three components and below on brightness, so it stands out on nothing and
    // falls back to its largest weighted values (duration 0.35, moon 0.3).
    const top = c(1, 1, 1, 1);
    const reasons = reasonComponents([top, top, top, top, c(1, 1, 0.5, 1)]);
    for (const reason of reasons.slice(0, 4)) {
      expect(reason).toEqual({ lead: "brightness", second: "duration" });
    }
    expect(reasons[4]).toEqual({ lead: "duration", second: "moon" });
  });

  it("leads with the largest weighted value for a single entry", () => {
    // Weighted: duration 0.175, moon 0.27, brightness 0.25, sky 0.1.
    expect(reasonComponents([c(0.5, 0.9, 1, 1)])).toEqual([{ lead: "moon", second: "brightness" }]);
    // Weighted: duration 0.35, moon 0.3, brightness 0.25, sky 0.1.
    expect(reasonComponents([c(1, 1, 1, 1)])).toEqual([{ lead: "duration", second: "moon" }]);
  });
});

describe("rankObjects with a log (PRD FR-018, Warsaw 2026-10-10)", () => {
  // Brightness alone separates these: M1 scores 1.0, M2 (vMag 5) about 0.04 lower, M3 (vMag 11) about 0.23 lower.
  const bright = synthetic(1, 89.9);
  const close = synthetic(2, 89.9, { vMag: 5 });
  const far = synthetic(3, 89.9, { vMag: 11 });
  const seenM1 = new Map([["M1", { count: 2, lastNight: "2026-09-12" }]]);

  it("moves a seen object below an unseen one that scores within LOG_PENALTY of it", () => {
    const unlogged = rank([bright, close]);
    expect(unlogged.entries.map((e) => e.object.messier)).toEqual([1, 2]);
    const gap = unlogged.entries[0].score.total - unlogged.entries[1].score.total;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(LOG_PENALTY);

    const logged = rank([bright, close], { seen: seenM1 });
    expect(logged.entries.map((e) => e.object.messier)).toEqual([2, 1]);
    expect(logged.entries[1].rankScore).toBeCloseTo(
      logged.entries[1].score.total - LOG_PENALTY + MESSIER_RANK_BONUS,
      12,
    );
  });

  it("keeps a seen object above an unseen one that scores more than LOG_PENALTY below it", () => {
    const unlogged = rank([bright, far]);
    expect(unlogged.entries[0].score.total - unlogged.entries[1].score.total).toBeGreaterThan(LOG_PENALTY);

    expect(rank([bright, far], { seen: seenM1 }).entries.map((e) => e.object.messier)).toEqual([1, 3]);
  });

  it("lets a seen object that the penalty would pull below the bar still clear and count", () => {
    // A low-interest, low-surface-brightness object: its total sits just above the bar.
    const borderline = synthetic(40, 89.9, { vMag: 11, type: "double-star", surfaceBrightness: 22 });
    const [unlogged] = rank([borderline]).entries;
    expect(unlogged.score.total).toBeGreaterThanOrEqual(MIN_OBJECT_SCORE);
    expect(unlogged.score.total - LOG_PENALTY).toBeLessThan(MIN_OBJECT_SCORE);

    const logged = rank([borderline], { seen: new Map([["M40", { count: 1, lastNight: "2026-09-12" }]]) });
    expect(logged.clearedCount).toBe(1);
    expect(logged.entries.map((e) => e.object.messier)).toEqual([40]);
  });

  it("carries the seen summary on a seen entry and null on the others", () => {
    const logged = rank([bright, far], { seen: seenM1 });
    expect(logged.entries.map((e) => e.seen)).toEqual([{ count: 2, lastNight: "2026-09-12" }, null]);
    expect(logged.entries[1].rankScore).toBeCloseTo(logged.entries[1].score.total + MESSIER_RANK_BONUS, 12);
  });

  it("ranks a log of only 1-2 ratings exactly like an empty log (invariant 4)", () => {
    const failedAttempts = seenSummaries(
      [
        { target: "M1", night: "2026-09-12", rating: 2 },
        { target: "M2", night: "2026-09-13", rating: 1 },
      ],
      "2026-10-10",
    );
    expect(rank([bright, close, far], { seen: failedAttempts })).toEqual(rank([bright, close, far]));
  });
});
