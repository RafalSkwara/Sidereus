import { describe, expect, it } from "vitest";

import { MESSIER } from "@/lib/catalogue";

import { EYEPIECES, TELESCOPE, WARSAW, warsawDarkWindow } from "./fixtures";
import { AF_FALL_LIST } from "./fixtures/beginner-reference";
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
    hubble: null,
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
  it("breaks a tie on total by Messier number, then non-Messier objects by id after the Messier ones", () => {
    const byNumber = rank([synthetic(7, 89.9), synthetic(3, 89.9), synthetic(5, 89.9)]);
    expect(byNumber.entries.map((e) => e.object.messier)).toEqual([3, 5, 7]);
    expect(byNumber.entries[0].score.total).toBe(byNumber.entries[2].score.total);

    const other = (id: string) => synthetic(0, 89.9, { id, messier: null });
    const ranking = rank([other("NGC869"), other("NGC7000"), synthetic(5, 89.9), other("IC405")]);
    // The Messier object leads on the bonus; the rest tie exactly and go by id (code-unit order).
    expect(ranking.entries.map((e) => e.object.id)).toEqual(["M5", "IC405", "NGC7000", "NGC869"]);
    expect(ranking.entries[1].score.total).toBe(ranking.entries[3].score.total);
    expect(ranking.entries[0].rankScore).toBe(ranking.entries[0].score.total + MESSIER_RANK_BONUS);
  });

  it("never lifts an object whose own score is below the bar into the list", () => {
    // A low-interest double star on the horizon's edge: dec 0° at vMag 11.2 just clears the bar, and each
    // further 0.3 mag costs about 0.009, so at 11.5 it falls short by less than MESSIER_RANK_BONUS. (Before
    // evening-showpieces the pair was 10 and 10.3: the duration term no longer divides a short pass by the
    // whole night, so the same object scores higher and clears at fainter magnitudes.)
    const faint = (vMag: number): RankableObject =>
      synthetic(40, 0, { vMag, type: "double-star", surfaceBrightness: 22 });
    const [reference] = rank([faint(11.2)]).entries;
    expect(reference.score.total).toBeGreaterThanOrEqual(MIN_OBJECT_SCORE);
    const shortfall = (0.3 * SCORE_WEIGHTS.brightness) / BRIGHTNESS_RAMP_MAG;
    expect(reference.score.total - shortfall).toBeLessThan(MIN_OBJECT_SCORE);
    expect(reference.score.total - shortfall + MESSIER_RANK_BONUS).toBeGreaterThan(MIN_OBJECT_SCORE);

    const ranking = rank([faint(11.5)], { limit: Number.POSITIVE_INFINITY });
    expect(ranking.clearedCount).toBe(0);
    expect(ranking.entries).toEqual([]);
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

describe("rankObjects' reachable objects (adjustable-session-plan, Warsaw)", () => {
  const faint = (messier: number, vMag: number): RankableObject =>
    synthetic(messier, 0, { vMag, type: "double-star", surfaceBrightness: 22 });

  it("lists every scored object in catalogue order: the listed, the cleared beyond the limit and the below-bar ones", () => {
    // M40 at vMag 11.5 scores but falls short of the bar (see the "never lifts" test above); M9 never rises above 15°.
    const catalogue = [synthetic(8, 89.9), faint(40, 11.5), synthetic(9, -60), synthetic(1, 89.9), synthetic(2, 89.9)];
    const ranking = rank(catalogue, { limit: 1 });
    expect(ranking.entries.map((e) => e.object.id)).toEqual(["M1"]);
    expect(ranking.clearedCount).toBe(3);
    expect(ranking.reachable.map((r) => r.object.id)).toEqual(["M8", "M40", "M1", "M2"]);
    expect(ranking.reachable.map((r) => r.cleared)).toEqual([true, false, true, true]);
    expect(ranking.reachable.every((r) => !r.washedOut)).toBe(true);
  });
});

describe("rankObjects under moonlight (moonlight-and-the-verdict, Warsaw, Bortle 6, 150 mm)", () => {
  const onNight = (date: string) => rank(MESSIER, { darkWindow: warsawDarkWindow(date) });

  it("lists only clusters under the full Moon of 2026-10-26: the Moon washes the galaxies out of the list", () => {
    const clusterTypes: readonly string[] = ["open-cluster", "globular-cluster", "asterism", "double-star"];
    const ranking = onNight("2026-10-26");
    expect(ranking.entries.length, "an empty list would pass vacuously").toBeGreaterThan(0);
    for (const entry of ranking.entries) {
      expect(clusterTypes, `${entry.object.id} is a ${entry.object.type}`).toContain(entry.object.type);
    }
    expect(ranking.washedOutCount).toBeGreaterThanOrEqual(3);
  });

  // The top five is checked against source AF (Astronomy.com, "See fall's best Messier objects") as a set, not
  // as the order the engine printed: a reorder within AF's fall picks passes, a retune that drops a published pick
  // fails (the AF check is stricter than the calibration oracle's k = 3: a retune that swaps a top-5 member for
  // another object passes the oracle but not this check).
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
    // Moon and sky are level across the list (spread 0, under REASON_MIN_SPREAD), so only duration and brightness are eligible.
    const reasons = reasonComponents([c(1, 0.75, 0.25, 0.75), c(0.25, 0.75, 1, 0.75), c(0.625, 0.75, 0.625, 0.75)]);
    // A: duration +0.13125 is named; brightness 0.25 is under the 0.625 mean, so it is not named → a lone reason.
    expect(reasons[0]).toEqual({ lead: "duration", second: null });
    // B: brightness +0.09375 is named; duration is under the mean → a lone reason.
    expect(reasons[1]).toEqual({ lead: "brightness", second: null });
    // C: level with the mean on both (named), no positive deviation → its largest weighted values:
    // duration 0.21875, brightness 0.15625.
    expect(reasons[2]).toEqual({ lead: "duration", second: "brightness" });
  });

  it("weights the deviation, so a smaller weighted gap loses to a bigger one", () => {
    // Sky deviates by ±0.5 (weighted 0.05); moon by ±0.2 (weighted 0.06). Both differ across the list by at least
    // REASON_MIN_SPREAD, so both are eligible; the means are duration 0.5, moon 0.7, brightness 0.5, sky 0.5.
    const reasons = reasonComponents([c(0.5, 0.9, 0.5, 1), c(0.5, 0.5, 0.5, 0)]);
    expect(reasons[0]).toEqual({ lead: "moon", second: "sky" });
    // The second entry is below the mean on moon and sky (not named) and level on duration and brightness (named):
    // no positive deviation → the weighted values, duration 0.175 then brightness 0.125.
    expect(reasons[1]).toEqual({ lead: "duration", second: "brightness" });
  });

  it("falls back to the largest weighted values for an entry that stands out on nothing", () => {
    // The four tops stand out on brightness (above the 0.9 mean), so they lead with it, then name duration (level with
    // its mean). The weaker entry is level on duration and below on brightness, so only duration is named: a lone reason.
    const top = c(1, 1, 1, 1);
    const reasons = reasonComponents([top, top, top, top, c(1, 1, 0.5, 1)]);
    for (const reason of reasons.slice(0, 4)) {
      expect(reason).toEqual({ lead: "brightness", second: "duration" });
    }
    expect(reasons[4]).toEqual({ lead: "duration", second: null });
  });

  it("names duration and brightness for a single entry, by the largest weighted value", () => {
    // One entry is its own mean: moon and sky cannot differ, so they are never eligible. Weighted: duration 0.175,
    // brightness 0.25.
    expect(reasonComponents([c(0.5, 0.9, 1, 1)])).toEqual([{ lead: "brightness", second: "duration" }]);
    // Weighted: duration 0.35, brightness 0.25.
    expect(reasonComponents([c(1, 1, 1, 1)])).toEqual([{ lead: "duration", second: "brightness" }]);
    // The moon's weight (0.3) is the larger, but the moon is not eligible: duration 0.07, brightness 0.025.
    expect(reasonComponents([c(0.2, 1, 0.1, 1)])).toEqual([{ lead: "duration", second: "brightness" }]);
  });

  it("never names the moon or the sky when five entries all have moon 1 and sky 1", () => {
    const listed = [c(1, 1, 0.2, 1), c(0.8, 1, 0.6, 1), c(0.6, 1, 1, 1), c(0.4, 1, 0.4, 1), c(0.2, 1, 0.8, 1)];
    for (const reason of reasonComponents(listed)) {
      expect(["moon", "sky"]).not.toContain(reason.lead);
      expect(["moon", "sky"]).not.toContain(reason.second);
    }
  });

  it("makes the moon eligible when one entry is 0.4 among entries at 1, naming it for the entries at the top", () => {
    // Moon spread 0.6, mean 0.88. Duration, brightness and sky are level, so the moon (+0.036 weighted) is the only
    // positive deviation for the four entries at 1.
    const listed = [c(0.5, 1, 0.5, 1), c(0.5, 1, 0.5, 1), c(0.5, 1, 0.5, 1), c(0.5, 1, 0.5, 1), c(0.5, 0.4, 0.5, 1)];
    const reasons = reasonComponents(listed);
    for (const reason of reasons.slice(0, 4)) {
      expect(reason.lead).toBe("moon");
    }
    // The 0.4 entry is under the mean, so the moon is not true of it: it is never named for it.
    expect(reasons[4].lead).not.toBe("moon");
    expect(reasons[4].second).not.toBe("moon");
  });

  it("never gives the brightness phrase to an entry below the listed mean on brightness", () => {
    // Brightness means 0.6; the 0.1 and 0.2 entries are under it, however large the other deviations are.
    const listed = [c(0.1, 1, 1, 1), c(0.2, 1, 0.9, 1), c(1, 1, 0.1, 1), c(1, 1, 0.2, 1), c(0.9, 1, 0.8, 1)];
    const reasons = reasonComponents(listed);
    reasons.forEach((reason, i) => {
      if (listed[i].brightness < 0.6) {
        expect(reason.lead).not.toBe("brightness");
        expect(reason.second).not.toBe("brightness");
      }
    });
    // And it is named where it is true: the brightest entry leads with it.
    expect(reasons[0].lead).toBe("brightness");
  });

  it("does not fall back to a below-mean brightness as the runner-up when the moon and the sky are lower still", () => {
    // Means: duration 0.667, moon 0.733, brightness 0.517, sky 0.733. The first entry is under the mean on moon,
    // brightness and sky, and above it on duration alone, so duration is the only component named for it. Brightness
    // (weighted deviation −0.0167) is still the least negative of the other three, so a runner-up chosen by deviation alone would pick it.
    const reasons = reasonComponents([c(1, 0.2, 0.45, 0.2), c(0.5, 1, 0.55, 1), c(0.5, 1, 0.55, 1)]);
    expect(reasons[0]).toEqual({ lead: "duration", second: null });
  });

  it("gives an entry below the mean on both duration and brightness a lead from the eligible ones and no second", () => {
    // Duration mean 0.6, brightness mean 0.6; the last entry is under both, so nothing is named for it: its lead
    // is the largest weighted value among the eligible components (duration 0.07 against brightness 0.05).
    const reasons = reasonComponents([c(1, 1, 1, 1), c(0.8, 1, 0.8, 1), c(0.2, 1, 0.2, 1)]);
    expect(reasons[2]).toEqual({ lead: "duration", second: null });
  });
});

describe("rankObjects with a log (PRD FR-018, Warsaw 2026-10-10)", () => {
  // Brightness alone separates these: M1 scores 1.0, M2 (vMag 5) about 0.04 lower, M3 (vMag 11) about 0.23 lower.
  const bright = synthetic(1, 89.9);
  const close = synthetic(2, 89.9, { vMag: 5 });
  const far = synthetic(3, 89.9, { vMag: 11 });
  const seenM1 = new Map([["M1", { count: 2, firstNight: "2026-09-01", lastNight: "2026-09-12" }]]);

  it("moves a seen object below an unseen one within LOG_PENALTY of it, and keeps it above one further than that", () => {
    const unlogged = rank([bright, close]);
    expect(unlogged.entries.map((e) => e.object.messier)).toEqual([1, 2]);
    const gap = unlogged.entries[0].score.total - unlogged.entries[1].score.total;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(LOG_PENALTY);
    expect(rank([bright, close], { seen: seenM1 }).entries.map((e) => e.object.messier)).toEqual([2, 1]);

    const farGap = rank([bright, far]).entries;
    expect(farGap[0].score.total - farGap[1].score.total).toBeGreaterThan(LOG_PENALTY);
    expect(rank([bright, far], { seen: seenM1 }).entries.map((e) => e.object.messier)).toEqual([1, 3]);
  });
});
