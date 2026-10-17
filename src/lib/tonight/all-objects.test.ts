import { describe, expect, it } from "vitest";
import { sortEntries, targetsRedirectPath } from "./all-objects";

/** Rows with just what ordering reads: rank and the peak instant. */
const at = (iso: string) => Date.parse(iso);
const entries = [
  { rank: 1, id: "M31", bestAt: at("2026-10-11T00:25:00Z") }, // 02:25 local, after midnight
  { rank: 2, id: "M39", bestAt: at("2026-10-10T21:16:00Z") }, // 23:16 local
  { rank: 3, id: "M13", bestAt: at("2026-10-10T19:40:00Z") }, // 21:40 local
  { rank: 4, id: "M52", bestAt: at("2026-10-10T21:16:00Z") }, // ties with M39
];

describe("sortEntries", () => {
  it("orders by best time across midnight, ties by rank", () => {
    expect(sortEntries(entries, "time").map((e) => e.id)).toEqual(["M13", "M39", "M52", "M31"]);
  });
});

describe("targetsRedirectPath", () => {
  const from = (query: string) => targetsRedirectPath(new URLSearchParams(query));

  it("drops an unknown order and every other parameter", () => {
    expect(from("")).toBe("/tonight/targets");
    expect(from("sort=peak")).toBe("/tonight/targets");
    expect(from("sort=%2F%2Fevil.example&next=x")).toBe("/tonight/targets");
    expect(from("site=abc&telescope=def")).toBe("/tonight/targets");
  });
});
