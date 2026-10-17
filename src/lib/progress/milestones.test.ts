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
  it("is the fixed set of eleven, in the order the page shows them, and the key guard accepts exactly those", () => {
    const keys = [
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
    ];
    expect(keys).toHaveLength(11);
    expect(MILESTONES.map((m) => m.key)).toEqual(keys);

    for (const { key } of MILESTONES) {
      expect(isMilestoneKey(key), key).toBe(true);
    }
    const bad = ["", "first", "messier-11", "FIRST-MOON", "first-moon ", 10, null, undefined, {}, ["first-moon"]];
    expect(bad).toHaveLength(10);
    bad.forEach((value, i) => {
      expect(isMilestoneKey(value), `bad value ${i}: ${JSON.stringify(value)}`).toBe(false);
    });
  });
});

describe("milestonesOf", () => {
  it("returns all eleven in MILESTONES order, none reached, with progress only on the count and all-of-a-set milestones, for an empty log; and reaches nothing for objects logged only at rating 1 or 2", () => {
    const states = milestonesOf(observingProgress([]));
    expect(states).toHaveLength(11);
    expect(states.map((s) => s.key)).toEqual(MILESTONES.map((m) => m.key));
    expect(states.every((s) => s.reachedNight === null)).toBe(true);
    expect(Object.fromEntries(states.map((s) => [s.key, s.progress]))).toEqual({
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

  it("dates a first of a kind at the earliest first night in its group, across both checklists", () => {
    const rows: [string, LogEntry[], MilestoneKey, string | null][] = [
      [
        "first-moon: the Moon's first rated-3 night",
        [
          { target: "moon", night: night(9), rating: 4 },
          { target: "moon", night: night(5), rating: 3 },
          { target: "moon", night: night(2), rating: 2 },
        ],
        "first-moon",
        night(5),
      ],
      [
        "first-planet: the earliest first night of any planet, not the Moon's",
        [
          { target: "saturn", night: night(12), rating: 4 },
          { target: "mars", night: night(7), rating: 3 },
          { target: "jupiter", night: night(30), rating: 5 },
          { target: "moon", night: night(1), rating: 5 },
        ],
        "first-planet",
        night(7),
      ],
      ["first-planet: not for the Moon alone", [{ target: "moon", night: night(1), rating: 5 }], "first-planet", null],
      ["first-galaxy: a Messier galaxy", [{ target: "M31", night: night(3), rating: 4 }], "first-galaxy", night(3)],
      [
        "first-galaxy: a Caldwell galaxy alone",
        [{ target: "IC342", night: night(4), rating: 3 }],
        "first-galaxy",
        night(4),
      ],
      [
        "first-galaxy: the earliest night across both checklists",
        [
          { target: "M31", night: night(10), rating: 4 },
          { target: "IC342", night: night(5), rating: 4 },
          { target: "M33", night: night(8), rating: 4 },
        ],
        "first-galaxy",
        night(5),
      ],
      [
        "first-galaxy: the date moves earlier when an earlier first night is added",
        [
          { target: "M31", night: night(10), rating: 4 },
          { target: "M32", night: night(4), rating: 3 },
        ],
        "first-galaxy",
        night(4),
      ],
      [
        "first-galaxy: the later date before that is added",
        [{ target: "M31", night: night(10), rating: 4 }],
        "first-galaxy",
        night(10),
      ],
      [
        "first-globular: a globular cluster",
        [{ target: "M13", night: night(2), rating: 4 }],
        "first-globular",
        night(2),
      ],
      ["first-globular: not other kinds", logged(["M31", "M45", "M27", "M42", "M1"]), "first-globular", null],
      ["first-nebula: a nebula (M8)", [{ target: "M8", night: night(6), rating: 4 }], "first-nebula", night(6)],
      [
        "first-nebula: an emission nebula (M43)",
        [{ target: "M43", night: night(6), rating: 4 }],
        "first-nebula",
        night(6),
      ],
      [
        "first-nebula: a reflection nebula (M78)",
        [{ target: "M78", night: night(6), rating: 4 }],
        "first-nebula",
        night(6),
      ],
      [
        "first-nebula: a planetary nebula (M27)",
        [{ target: "M27", night: night(6), rating: 4 }],
        "first-nebula",
        night(6),
      ],
      [
        "first-nebula: a supernova remnant (M1)",
        [{ target: "M1", night: night(6), rating: 4 }],
        "first-nebula",
        night(6),
      ],
      [
        "first-nebula: a cluster with nebula (M42)",
        [{ target: "M42", night: night(6), rating: 4 }],
        "first-nebula",
        night(6),
      ],
      [
        "first-nebula: a Caldwell nebula (NGC7000, Caldwell 20)",
        [{ target: "NGC7000", night: night(6), rating: 4 }],
        "first-nebula",
        night(6),
      ],
      [
        "first-nebula: not a globular, a galaxy or an open cluster",
        logged(["M13", "M31", "M45"]),
        "first-nebula",
        null,
      ],
    ];
    expect(rows).toHaveLength(18);
    for (const [label, entries, key, expected] of rows) {
      expect(stateOf(entries, key).reachedNight, label).toBe(expected);
    }
    // The Moon's first night is also the only milestone that log reaches.
    expect(reachedKeys(rows[0][1])).toEqual(["first-moon"]);
  });

  it("dates an all-of-a-set milestone at the latest first night once the whole set is seen (all-planets, caldwell-all) and shows how far along it is", () => {
    const ids = CALDWELL.map((object) => object.id);
    expect(ids).toHaveLength(61);
    const rows: [
      string,
      LogEntry[],
      MilestoneKey,
      { reachedNight: string | null; progress: { seen: number; total: number } },
    ][] = [
      [
        "six planets wait for the seventh",
        logged(PLANETS.slice(0, 6)),
        "all-planets",
        { reachedNight: null, progress: { seen: 6, total: 7 } },
      ],
      [
        "dated at the planet that completed the set, whatever the order, a later night of a seen planet moves nothing",
        [
          { target: "neptune", night: night(40), rating: 4 },
          { target: "mercury", night: night(3), rating: 4 },
          { target: "venus", night: night(9), rating: 4 },
          { target: "mars", night: night(5), rating: 4 },
          { target: "jupiter", night: night(2), rating: 4 },
          { target: "saturn", night: night(20), rating: 4 },
          { target: "uranus", night: night(11), rating: 4 },
          { target: "mercury", night: night(60), rating: 5 },
        ],
        "all-planets",
        { reachedNight: night(40), progress: { seen: 7, total: 7 } },
      ],
      [
        "the Moon is not a planet",
        [...logged(PLANETS.slice(0, 6)), { target: "moon", night: night(30), rating: 5 }],
        "all-planets",
        { reachedNight: null, progress: { seen: 6, total: 7 } },
      ],
      [
        "60 Caldwell objects are 60 of 61",
        logged(ids.slice(1)),
        "caldwell-all",
        { reachedNight: null, progress: { seen: 60, total: 61 } },
      ],
      [
        "all 61, the last seen on night 100; a later night of a seen object moves nothing",
        [
          ...logged(ids.slice(1)),
          { target: ids[0], night: night(100), rating: 3 },
          { target: ids[5], night: night(200), rating: 5 },
        ],
        "caldwell-all",
        { reachedNight: night(100), progress: { seen: 61, total: 61 } },
      ],
      [
        "61 Messier objects are no Caldwell objects",
        logged(messierUpTo(61)),
        "caldwell-all",
        { reachedNight: null, progress: { seen: 0, total: 61 } },
      ],
    ];
    expect(rows).toHaveLength(6);
    for (const [label, entries, key, expected] of rows) {
      expect(stateOf(entries, key), label).toEqual({ key, ...expected });
    }
  });

  it("dates a Messier count at its N-th earliest first night, counts an object once, caps the progress at N and counts neither Caldwell objects nor planets", () => {
    interface Expected {
      reachedNight: string | null;
      progress: { seen: number; total: number };
    }
    const rows: [string, LogEntry[], MilestoneKey, Expected][] = [
      [
        "messier-10 on the tenth earliest first night, not the last entry in the array",
        [
          ...messierUpTo(10)
            .map((target, i) => ({ target, night: night(2 * (i + 1)), rating: 4 }))
            .reverse(),
          { target: "M11", night: night(30), rating: 4 },
        ],
        "messier-10",
        { reachedNight: night(20), progress: { seen: 10, total: 10 } },
      ],
      [
        "nine objects are nine of ten",
        logged(messierUpTo(9)),
        "messier-10",
        { reachedNight: null, progress: { seen: 9, total: 10 } },
      ],
      [
        "two entries for one object count once",
        [
          ...logged(messierUpTo(9)),
          { target: "M9", night: night(50), rating: 5 },
          { target: "M1", night: night(0), rating: 5 },
        ],
        "messier-10",
        { reachedNight: null, progress: { seen: 9, total: 10 } },
      ],
      [
        "Caldwell objects and planets do not count",
        [...logged(messierUpTo(5)), ...logged(["NGC869", "NGC7000", "IC342", "jupiter", "moon"], 10)],
        "messier-10",
        { reachedNight: null, progress: { seen: 5, total: 10 } },
      ],
      [
        "thirty objects: messier-10 on its tenth night",
        logged(messierUpTo(30)),
        "messier-10",
        { reachedNight: night(9), progress: { seen: 10, total: 10 } },
      ],
      [
        "thirty objects: messier-25 on its 25th night",
        logged(messierUpTo(30)),
        "messier-25",
        { reachedNight: night(24), progress: { seen: 25, total: 25 } },
      ],
      [
        "thirty objects: messier-50 not yet",
        logged(messierUpTo(30)),
        "messier-50",
        { reachedNight: null, progress: { seen: 30, total: 50 } },
      ],
      [
        "fifty objects: messier-50 on its 50th night",
        logged(messierUpTo(50)),
        "messier-50",
        { reachedNight: night(49), progress: { seen: 50, total: 50 } },
      ],
      [
        "fifty objects: messier-110 not yet",
        logged(messierUpTo(50)),
        "messier-110",
        { reachedNight: null, progress: { seen: 50, total: 110 } },
      ],
      [
        "all 110 (NGC 5866 as M102 included)",
        logged(messierUpTo(110)),
        "messier-110",
        { reachedNight: night(109), progress: { seen: 110, total: 110 } },
      ],
      [
        "109 without M45",
        logged(messierUpTo(110)).filter((entry) => entry.target !== "M45"),
        "messier-110",
        { reachedNight: null, progress: { seen: 109, total: 110 } },
      ],
    ];
    expect(rows).toHaveLength(11);
    expect(logged(messierUpTo(110)).some((entry) => entry.target === "M102")).toBe(true);
    for (const [label, entries, key, expected] of rows) {
      expect(stateOf(entries, key), label).toEqual({ key, ...expected });
    }
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

  it("shows a stored milestone as reached even when the log no longer reaches it", () => {
    const stored = new Map<MilestoneKey, string>([["first-galaxy", night(3)]]);
    // The entry that reached it was deleted: the derived state has nothing, the stored night stands.
    expect(stateIn(derived([]), "first-galaxy").reachedNight).toBeNull();
    expect(stateIn(withStored(derived([]), stored), "first-galaxy").reachedNight).toBe(night(3));
  });

  it("lets the stored night win over the derived one, and the derived state stand for a key that is not stored, so milestones from before the record still show", () => {
    const entries: LogEntry[] = [{ target: "M31", night: night(9), rating: 4 }];
    const storedGalaxy = new Map<MilestoneKey, string>([["first-galaxy", night(3)]]);
    expect(stateIn(derived(entries), "first-galaxy").reachedNight).toBe(night(9));
    expect(stateIn(withStored(derived(entries), storedGalaxy), "first-galaxy").reachedNight).toBe(night(3));

    const storedMoon = new Map<MilestoneKey, string>([["first-moon", night(2)]]);
    const states = withStored(derived(nine), storedMoon);
    expect(stateIn(states, "first-globular").reachedNight).toBe(night(0));
    expect(stateIn(states, "first-moon").reachedNight).toBe(night(2));
  });

  it("returns the derived states unchanged when nothing is stored, in MILESTONES order, and takes progress from the derived state", () => {
    expect(withStored(derived(nine), new Map())).toEqual(derived(nine));
    expect(withStored(derived([]), new Map())).toEqual(derived([]));

    const stored = new Map<MilestoneKey, string>([
      ["caldwell-all", night(40)],
      ["first-moon", night(2)],
    ]);
    expect(withStored(derived([]), stored).map((state) => state.key)).toEqual(MILESTONES.map((m) => m.key));

    expect(stateIn(withStored(derived(nine), new Map([["messier-10", night(30)]])), "messier-10")).toEqual({
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
