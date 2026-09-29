import { describe, expect, it } from "vitest";
import { parseSort, sortEntries } from "./all-objects";

/** Rows with just what ordering reads: rank and the peak instant. */
const at = (iso: string) => Date.parse(iso);
const entries = [
  { rank: 1, id: "M31", bestAt: at("2026-10-11T00:25:00Z") }, // 02:25 local, after midnight
  { rank: 2, id: "M39", bestAt: at("2026-10-10T21:16:00Z") }, // 23:16 local
  { rank: 3, id: "M13", bestAt: at("2026-10-10T19:40:00Z") }, // 21:40 local
  { rank: 4, id: "M52", bestAt: at("2026-10-10T21:16:00Z") }, // ties with M39
];

describe("sortEntries", () => {
  it("keeps rank order by default", () => {
    expect(sortEntries(entries, "rank").map((e) => e.id)).toEqual(["M31", "M39", "M13", "M52"]);
  });

  it("orders by best time across midnight, ties by rank", () => {
    expect(sortEntries(entries, "time").map((e) => e.id)).toEqual(["M13", "M39", "M52", "M31"]);
  });

  it("returns a new array and leaves the input alone", () => {
    const copy = [...entries];
    const sorted = sortEntries(entries, "time");
    expect(sorted).not.toBe(entries);
    expect(entries).toEqual(copy);
  });
});

describe("parseSort", () => {
  it("reads time only from 'time', everything else is rank", () => {
    expect(parseSort("time")).toBe("time");
    expect(parseSort("rank")).toBe("rank");
    expect(parseSort(null)).toBe("rank");
    expect(parseSort("TIME")).toBe("rank");
    expect(parseSort("peak")).toBe("rank");
  });
});
