import { describe, expect, it } from "vitest";

import type { LogEntry } from "@/lib/engine";

import { observingProgress, type Checklist } from "./progress";

/**
 * Raw log entries go through the real rule (`seenSummaries`); every expectation is written by hand from the
 * catalogue (M31 is the Andromeda Galaxy, NGC869 is Caldwell 14, NGC7000 is Caldwell 20), never derived from
 * the code under test.
 */

function itemOf(list: Checklist, id: string) {
  return list.items.find((item) => item.id === id);
}

describe("observingProgress (PRD FR-039, FR-040, US-06)", () => {
  it("lists all 110 Messier and 61 Caldwell objects with nothing ticked for an empty log, Messier by M number and Caldwell by C number, with the catalogue's names", () => {
    const progress = observingProgress([]);
    expect(progress.messier).toMatchObject({ total: 110, seenCount: 0 });
    expect(progress.messier.items).toHaveLength(110);
    expect(progress.caldwell).toMatchObject({ total: 61, seenCount: 0 });
    expect(progress.caldwell.items).toHaveLength(61);
    expect(progress.messier.items.every((item) => item.seen === null)).toBe(true);
    expect(progress.caldwell.items.every((item) => item.seen === null)).toBe(true);

    const { messier, caldwell } = progress;
    expect(messier.items.map((item) => item.number)).toEqual(Array.from({ length: 110 }, (_, i) => i + 1));
    expect(messier.items[0]).toMatchObject({
      id: "M1",
      number: 1,
      label: "M1",
      commonName: "Crab Nebula",
      type: "supernova-remnant",
    });
    expect(messier.items[30]).toMatchObject({ id: "M31", number: 31, commonName: "Andromeda Galaxy", type: "galaxy" });
    expect(messier.items[109]).toMatchObject({ id: "M110", number: 110, commonName: null });

    const numbers = caldwell.items.map((item) => item.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(61);
    expect(caldwell.items[0]).toMatchObject({ id: "NGC188", number: 1, label: "NGC 188", type: "open-cluster" });
    expect(caldwell.items[1]).toMatchObject({ id: "NGC40", number: 2, commonName: "Bow-Tie nebula" });
    expect(itemOf(caldwell, "NGC869")).toMatchObject({ number: 14, label: "NGC 869 / 884" });
    expect(itemOf(caldwell, "NGC7000")).toMatchObject({ number: 20, label: "NGC 7000" });
    expect(caldwell.items.at(-1)).toMatchObject({ id: "NGC7293", number: 63 });
  });

  it("ticks an object only from a rating of 3 (invariant 4), counts a night once, dates the first night at the earliest qualifying one, and keeps the lists apart", () => {
    // Rated 1 or 2 only: never ticked, no first night for a planet or the Moon either.
    const low = observingProgress([
      { target: "M31", night: "2026-09-20", rating: 2 },
      { target: "M31", night: "2026-09-21", rating: 1 },
      { target: "jupiter", night: "2026-09-22", rating: 2 },
      { target: "moon", night: "2026-09-23", rating: 1 },
    ]);
    expect(itemOf(low.messier, "M31")?.seen).toBeNull();
    expect(low.messier.seenCount).toBe(0);
    expect(low.firsts.every((first) => first.firstNight === null)).toBe(true);

    // A rated-3 night counts, a lower rating on another night is ignored; two entries on one night count once;
    // the first night is the earliest qualifying one, never an earlier night rated 2.
    const progress = observingProgress([
      { target: "M31", night: "2026-09-10", rating: 2 },
      { target: "M31", night: "2026-09-12", rating: 3 },
      { target: "M13", night: "2026-09-12", rating: 4 },
      { target: "M13", night: "2026-09-12", rating: 5 },
      { target: "M45", night: "2026-10-02", rating: 4 },
      { target: "M45", night: "2026-08-20", rating: 3 },
      { target: "M45", night: "2026-09-15", rating: 5 },
      { target: "M45", night: "2026-07-01", rating: 2 },
      // Keys in neither catalogue, the planets nor the Moon are ignored.
      { target: "NGC1", night: "2026-09-12", rating: 5 },
      { target: "M999", night: "2026-09-12", rating: 5 },
      { target: "pluto", night: "2026-09-12", rating: 5 },
      // Caldwell objects count on their own list.
      { target: "NGC869", night: "2026-09-04", rating: 4 },
      { target: "NGC7000", night: "2026-09-05", rating: 3 },
    ]);
    expect(itemOf(progress.messier, "M31")?.seen).toEqual({
      count: 1,
      firstNight: "2026-09-12",
      lastNight: "2026-09-12",
    });
    expect(itemOf(progress.messier, "M13")?.seen).toEqual({
      count: 1,
      firstNight: "2026-09-12",
      lastNight: "2026-09-12",
    });
    expect(itemOf(progress.messier, "M45")?.seen).toEqual({
      count: 3,
      firstNight: "2026-08-20",
      lastNight: "2026-10-02",
    });
    expect(progress.messier.seenCount).toBe(3);
    expect(progress.caldwell.seenCount).toBe(2);
    expect(progress.messier.total).toBe(110);
    expect(progress.caldwell.total).toBe(61);
    expect(progress.caldwell.items.filter((item) => item.seen).map((item) => item.id)).toEqual(["NGC869", "NGC7000"]);
    expect(itemOf(progress.caldwell, "NGC869")?.seen?.firstNight).toBe("2026-09-04");
    expect(progress.firsts.map((first) => first.key)).not.toContain("pluto");
  });

  it("lists the seven planets in solar order, then the Moon, each with its first night or null", () => {
    const progress = observingProgress([
      { target: "saturn", night: "2026-09-12", rating: 4 },
      { target: "jupiter", night: "2026-09-20", rating: 3 },
      { target: "jupiter", night: "2026-08-30", rating: 5 },
      { target: "moon", night: "2026-10-01", rating: 4 },
      { target: "mars", night: "2026-09-02", rating: 2 },
    ]);
    expect(progress.firsts).toEqual([
      { key: "mercury", firstNight: null },
      { key: "venus", firstNight: null },
      { key: "mars", firstNight: null },
      { key: "jupiter", firstNight: "2026-08-30" },
      { key: "saturn", firstNight: "2026-09-12" },
      { key: "uranus", firstNight: null },
      { key: "neptune", firstNight: null },
      { key: "moon", firstNight: "2026-10-01" },
    ]);
    // Planets and the Moon are firsts only, never on a checklist.
    expect(progress.messier.seenCount).toBe(0);
    expect(progress.caldwell.seenCount).toBe(0);
  });

  it("follows the log: unticks an object when its only qualifying entry is removed or re-rated, and moves the first night forward when the earliest is removed", () => {
    const logged: LogEntry[] = [
      { target: "M31", night: "2026-09-12", rating: 4 },
      { target: "NGC7000", night: "2026-09-13", rating: 5 },
    ];
    expect(observingProgress(logged).messier.seenCount).toBe(1);

    const deleted = logged.filter((entry) => entry.target !== "M31");
    const afterDelete = observingProgress(deleted);
    expect(afterDelete.messier.seenCount).toBe(0);
    expect(itemOf(afterDelete.messier, "M31")?.seen).toBeNull();
    expect(afterDelete.caldwell.seenCount).toBe(1);

    const reRated = logged.map((entry) => (entry.target === "M31" ? { ...entry, rating: 2 } : entry));
    expect(observingProgress(reRated).messier.seenCount).toBe(0);

    const twice: LogEntry[] = [
      { target: "M31", night: "2026-08-01", rating: 4 },
      { target: "M31", night: "2026-09-20", rating: 4 },
    ];
    expect(itemOf(observingProgress(twice).messier, "M31")?.seen).toEqual({
      count: 2,
      firstNight: "2026-08-01",
      lastNight: "2026-09-20",
    });
    expect(itemOf(observingProgress(twice.slice(1)).messier, "M31")?.seen).toEqual({
      count: 1,
      firstNight: "2026-09-20",
      lastNight: "2026-09-20",
    });
  });
});
