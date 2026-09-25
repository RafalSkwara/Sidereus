import { beforeAll, describe, expect, it } from "vitest";

import { MESSIER } from "@/lib/catalogue";

import { WARSAW } from "./fixtures";
import { observingNight } from "./night";
import { MAX_RANKED_OBJECTS, MIN_OBJECT_SCORE, darknessThresholdDegForBortle } from "./parameters";
import { rankObjects, reasonComponents } from "./ranking";
import type { RankInput, RankableObject, Ranking } from "./ranking";
import type { ScoreComponents } from "./score";
import { darkWindow } from "./sun";
import type { DarkWindow } from "./types";

const BORTLE = 6;
const TELESCOPE = { id: "t1", apertureMm: 150, focalLengthMm: 750 };
const EYEPIECES = [
  { id: "e25", focalLengthMm: 25, afovDeg: 50 },
  { id: "e10", focalLengthMm: 10, afovDeg: 50 },
];

function warsawDarkWindow(): Extract<DarkWindow, { kind: "window" }> {
  const dark = darkWindow(WARSAW, observingNight("2026-10-10", WARSAW.timeZone), darknessThresholdDegForBortle(BORTLE));
  if (dark.kind !== "window") {
    throw new Error("expected a dark window on 2026-10-10 in Warsaw");
  }
  return dark;
}

/** A bright, compact cluster at the given declination: it scores near 1 whenever it is up. */
function synthetic(messier: number, decDeg: number, overrides: Partial<RankableObject> = {}): RankableObject {
  return {
    messier,
    raHours: 0,
    decDeg,
    vMag: 1,
    surfaceBrightness: null,
    type: "open-cluster",
    majorAxisArcmin: 5,
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
      telescopeId: "t1",
    });
  });

  it("breaks a tie on total by Messier number ascending", () => {
    const ranking = rank([synthetic(7, 89.9), synthetic(3, 89.9), synthetic(5, 89.9)]);
    expect(ranking.entries.map((e) => e.object.messier)).toEqual([3, 5, 7]);
    expect(ranking.entries[0]?.score.total).toBe(ranking.entries[2]?.score.total);
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

  it("keeps the caller's object and eyepiece types, pairs eyepieces and reports the telescope", () => {
    const named = { ...synthetic(1, 89.9), commonName: "Test cluster" };
    const ranking = rank([named]);
    expect(ranking.entries).toHaveLength(1);
    const [entry] = ranking.entries;
    expect(entry.object.commonName).toBe("Test cluster");
    expect(entry.pair).toEqual({ kind: "pair", finding: EYEPIECES[0], detail: EYEPIECES[1] });
    expect(entry.peak).toEqual(entry.score.window.peak);
    expect(ranking.telescopeId).toBe("t1");
  });

  it("leaves the pair null with an empty kit", () => {
    expect(rank([synthetic(1, 89.9)], { eyepieces: [] }).entries[0]?.pair).toBeNull();
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

describe("reasonComponents", () => {
  const c = (duration: number, moon: number, brightness: number, sky: number): ScoreComponents => ({
    duration,
    moon,
    brightness,
    sky,
  });

  it("returns nothing for an empty list", () => {
    expect(reasonComponents([])).toEqual([]);
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
