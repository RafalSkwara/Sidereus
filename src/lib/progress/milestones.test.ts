import { describe, expect, it } from "vitest";

import { CALDWELL } from "@/lib/catalogue";
import type { LogEntry } from "@/lib/engine";

import {
  MILESTONES,
  isMilestoneKey,
  milestonesOf,
  newlyReached,
  withStored,
  type MilestoneKey,
  type MilestoneState,
} from "./milestones";
import { observingProgress } from "./progress";

/**
 * Hand-written log entries go through the real rule (`observingProgress`, which goes through `seenSummaries`);
 * no progress object is built by hand (test-plan 6.3). Catalogue facts are read by hand: M31, M32 and M33 are
 * galaxies, M2-M5, M9, M10, M12-M14 are globular clusters, M8 is a nebula, M43 an emission nebula, M78 a
 * reflection nebula, M27 a planetary nebula, M1 a supernova remnant, M42 a cluster with nebula, M45 an open
 * cluster, and IC342 (Caldwell 5) is a galaxy.
 */

/** The night `offset` days after 2026-01-01, as `YYYY-MM-DD`. */
function night(offset: number): string {
  return new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);
}

/** One entry rated 4 for each target, on consecutive nights starting at `start` (a day offset). */
function logged(targets: readonly string[], start = 0): LogEntry[] {
  return targets.map((target, i) => ({ target, night: night(start + i), rating: 4 }));
}

/** M1 to M<n>. */
function messierUpTo(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `M${i + 1}`);
}

function stateOf(entries: readonly LogEntry[], key: MilestoneKey) {
  const state = milestonesOf(observingProgress(entries)).find((s) => s.key === key);
  if (!state) {
    throw new Error(`no state for ${key}`);
  }
  return state;
}

function reachedKeys(entries: readonly LogEntry[]): MilestoneKey[] {
  return milestonesOf(observingProgress(entries))
    .filter((s) => s.reachedNight !== null)
    .map((s) => s.key);
}

function newlyBetween(before: readonly LogEntry[], after: readonly LogEntry[]): MilestoneKey[] {
  return newlyReached(milestonesOf(observingProgress(before)), milestonesOf(observingProgress(after)));
}

const PLANETS = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"];

describe("MILESTONES and isMilestoneKey (owner decision 1, PRD FR-041)", () => {
  it("is the fixed set of eleven, in the order the page shows them", () => {
    expect(MILESTONES.map((m) => m.key)).toEqual([
      "first-moon",
      "first-planet",
      "all-planets",
      "first-galaxy",
      "first-globular",
      "first-nebula",
      "messier-10",
      "messier-25",
      "messier-50",
      "messier-110",
      "caldwell-all",
    ]);
  });

  it("accepts exactly the eleven keys", () => {
    for (const { key } of MILESTONES) {
      expect(isMilestoneKey(key)).toBe(true);
    }
    for (const bad of [
      "",
      "first",
      "messier-11",
      "FIRST-MOON",
      "first-moon ",
      10,
      null,
      undefined,
      {},
      ["first-moon"],
    ]) {
      expect(isMilestoneKey(bad)).toBe(false);
    }
  });
});

describe("milestonesOf", () => {
  it("returns all eleven in MILESTONES order, none reached, for an empty log", () => {
    const states = milestonesOf(observingProgress([]));
    expect(states.map((s) => s.key)).toEqual(MILESTONES.map((m) => m.key));
    expect(states.every((s) => s.reachedNight === null)).toBe(true);
  });

  it("carries progress only for the count and all-of-a-set milestones", () => {
    const states = milestonesOf(observingProgress([]));
    const withProgress = Object.fromEntries(states.map((s) => [s.key, s.progress]));
    expect(withProgress).toEqual({
      "first-moon": undefined,
      "first-planet": undefined,
      "all-planets": { seen: 0, total: 7 },
      "first-galaxy": undefined,
      "first-globular": undefined,
      "first-nebula": undefined,
      "messier-10": { seen: 0, total: 10 },
      "messier-25": { seen: 0, total: 25 },
      "messier-50": { seen: 0, total: 50 },
      "messier-110": { seen: 0, total: 110 },
      "caldwell-all": { seen: 0, total: 61 },
    });
  });

  it("reaches nothing for objects logged only at rating 1 or 2", () => {
    const entries: LogEntry[] = [
      ...messierUpTo(10).map((target, i) => ({ target, night: night(i), rating: 2 })),
      { target: "M31", night: night(20), rating: 1 },
      { target: "moon", night: night(21), rating: 2 },
      { target: "jupiter", night: night(22), rating: 1 },
      { target: "IC342", night: night(23), rating: 2 },
    ];
    expect(reachedKeys(entries)).toEqual([]);
    expect(stateOf(entries, "messier-10").progress).toEqual({ seen: 0, total: 10 });
  });

  describe("first of a kind: the earliest first night in the group", () => {
    it("reaches first-moon on the Moon's first rated-3 night", () => {
      const entries: LogEntry[] = [
        { target: "moon", night: night(9), rating: 4 },
        { target: "moon", night: night(5), rating: 3 },
        { target: "moon", night: night(2), rating: 2 },
      ];
      expect(stateOf(entries, "first-moon").reachedNight).toBe(night(5));
      expect(reachedKeys(entries)).toEqual(["first-moon"]);
    });

    it("reaches first-planet on the earliest first night of any planet, and not for the Moon", () => {
      const entries: LogEntry[] = [
        { target: "saturn", night: night(12), rating: 4 },
        { target: "mars", night: night(7), rating: 3 },
        { target: "jupiter", night: night(30), rating: 5 },
        { target: "moon", night: night(1), rating: 5 },
      ];
      expect(stateOf(entries, "first-planet").reachedNight).toBe(night(7));
      expect(stateOf([{ target: "moon", night: night(1), rating: 5 }], "first-planet").reachedNight).toBeNull();
    });

    it("reaches first-galaxy from a Messier galaxy and from a Caldwell galaxy alone", () => {
      expect(stateOf([{ target: "M31", night: night(3), rating: 4 }], "first-galaxy").reachedNight).toBe(night(3));
      expect(stateOf([{ target: "IC342", night: night(4), rating: 3 }], "first-galaxy").reachedNight).toBe(night(4));
    });

    it("dates a first-of-a-kind at the earliest night across both checklists", () => {
      const entries: LogEntry[] = [
        { target: "M31", night: night(10), rating: 4 },
        { target: "IC342", night: night(5), rating: 4 },
        { target: "M33", night: night(8), rating: 4 },
      ];
      expect(stateOf(entries, "first-galaxy").reachedNight).toBe(night(5));
    });

    it("reaches first-globular from a globular cluster and not from other kinds", () => {
      expect(stateOf([{ target: "M13", night: night(2), rating: 4 }], "first-globular").reachedNight).toBe(night(2));
      const others = logged(["M31", "M45", "M27", "M42", "M1"]);
      expect(stateOf(others, "first-globular").reachedNight).toBeNull();
    });

    it.each([
      ["nebula", "M8"],
      ["emission-nebula", "M43"],
      ["reflection-nebula", "M78"],
      ["planetary-nebula", "M27"],
      ["supernova-remnant", "M1"],
      ["cluster-with-nebula", "M42"],
    ])("reaches first-nebula from a %s (%s)", (_type, target) => {
      expect(stateOf([{ target, night: night(6), rating: 4 }], "first-nebula").reachedNight).toBe(night(6));
    });

    it("reaches first-nebula from a Caldwell nebula too", () => {
      // NGC7000 is Caldwell 20, an emission nebula.
      expect(stateOf([{ target: "NGC7000", night: night(6), rating: 4 }], "first-nebula").reachedNight).toBe(night(6));
    });

    it("does not reach first-nebula from a globular, a galaxy or an open cluster", () => {
      expect(stateOf(logged(["M13", "M31", "M45"]), "first-nebula").reachedNight).toBeNull();
    });

    it("moves the date earlier when an earlier first night is added", () => {
      const later: LogEntry[] = [{ target: "M31", night: night(10), rating: 4 }];
      const earlier: LogEntry[] = [...later, { target: "M32", night: night(4), rating: 3 }];
      expect(stateOf(later, "first-galaxy").reachedNight).toBe(night(10));
      expect(stateOf(earlier, "first-galaxy").reachedNight).toBe(night(4));
    });
  });

  describe("all-planets: the latest first night, once all seven are seen", () => {
    it("waits for the seventh planet and shows how far along it is", () => {
      const six = logged(PLANETS.slice(0, 6));
      expect(stateOf(six, "all-planets")).toEqual({
        key: "all-planets",
        reachedNight: null,
        progress: { seen: 6, total: 7 },
      });
    });

    it("is dated at the first night of the planet that completed the set, whatever the order of the entries", () => {
      const entries: LogEntry[] = [
        { target: "neptune", night: night(40), rating: 4 },
        { target: "mercury", night: night(3), rating: 4 },
        { target: "venus", night: night(9), rating: 4 },
        { target: "mars", night: night(5), rating: 4 },
        { target: "jupiter", night: night(2), rating: 4 },
        { target: "saturn", night: night(20), rating: 4 },
        { target: "uranus", night: night(11), rating: 4 },
        // A later night for an already seen planet does not move the date.
        { target: "mercury", night: night(60), rating: 5 },
      ];
      expect(stateOf(entries, "all-planets")).toEqual({
        key: "all-planets",
        reachedNight: night(40),
        progress: { seen: 7, total: 7 },
      });
    });

    it("does not count the Moon as a planet", () => {
      const entries = [...logged(PLANETS.slice(0, 6)), { target: "moon", night: night(30), rating: 5 }];
      expect(stateOf(entries, "all-planets").reachedNight).toBeNull();
      expect(stateOf(entries, "all-planets").progress).toEqual({ seen: 6, total: 7 });
    });
  });

  describe("Messier counts: the N-th earliest first night", () => {
    it("reaches messier-10 on the night of the tenth earliest first night, not the last entry in the array", () => {
      // Ten objects on nights 2, 4, ..., 20, listed latest first, plus an eleventh on night 30.
      const entries: LogEntry[] = [
        ...messierUpTo(10)
          .map((target, i) => ({ target, night: night(2 * (i + 1)), rating: 4 }))
          .reverse(),
        { target: "M11", night: night(30), rating: 4 },
      ];
      expect(stateOf(entries, "messier-10")).toEqual({
        key: "messier-10",
        reachedNight: night(20),
        progress: { seen: 10, total: 10 },
      });
    });

    it("is not reached by nine objects, and shows nine of ten", () => {
      const entries = logged(messierUpTo(9));
      expect(stateOf(entries, "messier-10")).toEqual({
        key: "messier-10",
        reachedNight: null,
        progress: { seen: 9, total: 10 },
      });
    });

    it("counts two entries for one object once", () => {
      const entries: LogEntry[] = [
        ...logged(messierUpTo(9)),
        // The ninth object again, on another night, and the first on its own night twice.
        { target: "M9", night: night(50), rating: 5 },
        { target: "M1", night: night(0), rating: 5 },
      ];
      expect(stateOf(entries, "messier-10").reachedNight).toBeNull();
      expect(stateOf(entries, "messier-10").progress?.seen).toBe(9);
    });

    it("does not count Caldwell objects or the planets towards the Messier counts", () => {
      const entries = [...logged(messierUpTo(5)), ...logged(["NGC869", "NGC7000", "IC342", "jupiter", "moon"], 10)];
      expect(stateOf(entries, "messier-10").progress?.seen).toBe(5);
      expect(stateOf(entries, "messier-10").reachedNight).toBeNull();
    });

    it("dates each count at its own N-th night and caps the progress at N", () => {
      const entries = logged(messierUpTo(30));
      expect(stateOf(entries, "messier-10")).toMatchObject({
        reachedNight: night(9),
        progress: { seen: 10, total: 10 },
      });
      expect(stateOf(entries, "messier-25")).toMatchObject({
        reachedNight: night(24),
        progress: { seen: 25, total: 25 },
      });
      expect(stateOf(entries, "messier-50")).toMatchObject({ reachedNight: null, progress: { seen: 30, total: 50 } });
      expect(reachedKeys(entries)).toContain("messier-25");
      expect(reachedKeys(entries)).not.toContain("messier-50");
    });

    it("reaches messier-50 and not messier-110 at fifty", () => {
      const entries = logged(messierUpTo(50));
      expect(stateOf(entries, "messier-50")).toMatchObject({
        reachedNight: night(49),
        progress: { seen: 50, total: 50 },
      });
      expect(stateOf(entries, "messier-110")).toMatchObject({ reachedNight: null, progress: { seen: 50, total: 110 } });
    });

    it("reaches messier-110 on the latest first night once all 110 are seen, NGC 5866 (M102) included", () => {
      const all = logged(messierUpTo(110));
      expect(all.some((entry) => entry.target === "M102")).toBe(true);
      expect(stateOf(all, "messier-110")).toEqual({
        key: "messier-110",
        reachedNight: night(109),
        progress: { seen: 110, total: 110 },
      });
      // Without M45 (the 45th entry), 109 are seen.
      const missingOne = all.filter((entry) => entry.target !== "M45");
      expect(stateOf(missingOne, "messier-110")).toMatchObject({
        reachedNight: null,
        progress: { seen: 109, total: 110 },
      });
    });
  });

  describe("caldwell-all: the latest first night, once all 61 are seen", () => {
    const ids = CALDWELL.map((object) => object.id);

    it("is not reached by 60 and shows 60 of 61", () => {
      expect(stateOf(logged(ids.slice(1)), "caldwell-all")).toEqual({
        key: "caldwell-all",
        reachedNight: null,
        progress: { seen: 60, total: 61 },
      });
    });

    it("is dated at the latest first night when all 61 are seen", () => {
      // The first object is seen last: night 100, after the other sixty on nights 0-59.
      const entries: LogEntry[] = [
        ...logged(ids.slice(1)),
        { target: ids[0], night: night(100), rating: 3 },
        // A later night for an object already seen does not move the date.
        { target: ids[5], night: night(200), rating: 5 },
      ];
      expect(stateOf(entries, "caldwell-all")).toEqual({
        key: "caldwell-all",
        reachedNight: night(100),
        progress: { seen: 61, total: 61 },
      });
    });

    it("is not reached by 61 Messier objects", () => {
      expect(stateOf(logged(messierUpTo(61)), "caldwell-all")).toMatchObject({
        reachedNight: null,
        progress: { seen: 0, total: 61 },
      });
    });
  });

  it("follows the log: removing the only reaching entry un-reaches the derived state", () => {
    const entries: LogEntry[] = [
      { target: "M31", night: night(3), rating: 4 },
      { target: "moon", night: night(4), rating: 4 },
    ];
    expect(reachedKeys(entries)).toEqual(["first-moon", "first-galaxy"]);
    const withoutGalaxy = entries.filter((entry) => entry.target !== "M31");
    expect(reachedKeys(withoutGalaxy)).toEqual(["first-moon"]);
  });
});

describe("newlyReached", () => {
  const nine = logged(["M2", "M3", "M4", "M5", "M9", "M10", "M12", "M13", "M14"]);

  it("is empty for an unchanged log, empty or not", () => {
    expect(newlyBetween([], [])).toEqual([]);
    expect(newlyBetween(nine, nine)).toEqual([]);
    expect(newlyReached(milestonesOf(observingProgress(nine)), milestonesOf(observingProgress(nine)))).toEqual([]);
  });

  it("is empty when the added entry is rated 1 or 2, even for an object that would reach a milestone", () => {
    expect(newlyBetween(nine, [...nine, { target: "M31", night: night(20), rating: 2 }])).toEqual([]);
    expect(newlyBetween([], [{ target: "moon", night: night(1), rating: 1 }])).toEqual([]);
    // A rating of 2 on the tenth object does not reach messier-10.
    expect(newlyBetween(nine, [...nine, { target: "M11", night: night(21), rating: 2 }])).toEqual([]);
  });

  it("names the milestone a saved entry reaches", () => {
    expect(newlyBetween([], [{ target: "moon", night: night(1), rating: 4 }])).toEqual(["first-moon"]);
    expect(newlyBetween(nine, [...nine, { target: "M11", night: night(21), rating: 3 }])).toEqual(["messier-10"]);
  });

  it("names several milestones reached by one entry, in MILESTONES order", () => {
    // The tenth object is also the first galaxy; the globulars were already reached.
    expect(reachedKeys(nine)).toEqual(["first-globular"]);
    expect(newlyBetween(nine, [...nine, { target: "M31", night: night(20), rating: 4 }])).toEqual([
      "first-galaxy",
      "messier-10",
    ]);
  });

  it("does not name a milestone that was already reached, only the dates moving", () => {
    // An earlier night for a second galaxy moves first-galaxy's date but is not a new milestone.
    const before = [...nine, { target: "M31", night: night(20), rating: 4 }];
    const after = [...before, { target: "M32", night: night(1), rating: 4 }];
    expect(stateOf(after, "first-galaxy").reachedNight).toBe(night(1));
    expect(newlyBetween(before, after)).toEqual([]);
  });

  it("names a milestone reached again after it was lost, because it compares the two logs only", () => {
    const withGalaxy: LogEntry[] = [{ target: "M31", night: night(3), rating: 4 }];
    expect(newlyBetween(withGalaxy, [])).toEqual([]);
    expect(newlyBetween([], withGalaxy)).toEqual(["first-galaxy"]);
  });

  it("is empty when an entry is removed, which can only un-reach a derived milestone", () => {
    expect(newlyBetween([...nine, { target: "M31", night: night(20), rating: 4 }], nine)).toEqual([]);
  });
});

describe("withStored", () => {
  const nine = logged(["M2", "M3", "M4", "M5", "M9", "M10", "M12", "M13", "M14"]);
  const derived = (entries: readonly LogEntry[]) => milestonesOf(observingProgress(entries));
  const stateIn = (states: readonly MilestoneState[], key: MilestoneKey) => {
    const state = states.find((s) => s.key === key);
    if (!state) {
      throw new Error(`no state for ${key}`);
    }
    return state;
  };

  it("returns the derived states unchanged when nothing is stored", () => {
    expect(withStored(derived(nine), new Map())).toEqual(derived(nine));
    expect(withStored(derived([]), new Map())).toEqual(derived([]));
  });

  it("keeps every milestone in MILESTONES order", () => {
    const stored = new Map<MilestoneKey, string>([
      ["caldwell-all", night(40)],
      ["first-moon", night(2)],
    ]);
    expect(withStored(derived([]), stored).map((state) => state.key)).toEqual(MILESTONES.map((m) => m.key));
  });

  it("shows a stored milestone as reached even when the log no longer reaches it", () => {
    const stored = new Map<MilestoneKey, string>([["first-galaxy", night(3)]]);
    // The entry that reached it was deleted: the derived state has nothing, the stored night stands.
    expect(stateIn(derived([]), "first-galaxy").reachedNight).toBeNull();
    expect(stateIn(withStored(derived([]), stored), "first-galaxy").reachedNight).toBe(night(3));
  });

  it("lets the stored night win over the derived one", () => {
    const entries: LogEntry[] = [{ target: "M31", night: night(9), rating: 4 }];
    const stored = new Map<MilestoneKey, string>([["first-galaxy", night(3)]]);
    expect(stateIn(derived(entries), "first-galaxy").reachedNight).toBe(night(9));
    expect(stateIn(withStored(derived(entries), stored), "first-galaxy").reachedNight).toBe(night(3));
  });

  it("lets the derived state stand for a key that is not stored, so milestones from before the record still show", () => {
    const stored = new Map<MilestoneKey, string>([["first-moon", night(2)]]);
    const states = withStored(derived(nine), stored);
    expect(stateIn(states, "first-globular").reachedNight).toBe(night(0));
    expect(stateIn(states, "first-moon").reachedNight).toBe(night(2));
  });

  it("takes progress from the derived state, for a stored count milestone too", () => {
    const stored = new Map<MilestoneKey, string>([["messier-10", night(30)]]);
    const states = withStored(derived(nine), stored);
    expect(stateIn(states, "messier-10")).toEqual({
      key: "messier-10",
      reachedNight: night(30),
      progress: { seen: 9, total: 10 },
    });
    // A milestone without a count stays without one.
    expect(stateIn(withStored(derived([]), new Map([["first-moon", night(2)]])), "first-moon")).toEqual({
      key: "first-moon",
      reachedNight: night(2),
    });
  });
});
