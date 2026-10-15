import { describe, expect, it } from "vitest";

import { applyPlanEdits } from "./plan-edits";

// Suggested: the Moon, Jupiter, then M31 and M13; reachable: every deep-sky object with a window, M31 and M13 included.
const suggested = [{ key: "moon" }, { key: "jupiter" }, { key: "M31" }, { key: "M13" }];
const reachable = [{ key: "M13" }, { key: "M31" }, { key: "M45" }, { key: "NGC7000" }];

const apply = (saved: string[] | null) => applyPlanEdits({ suggested, saved, reachable });
const keys = (list: { item: { key: string } }[]) => list.map((entry) => entry.item.key);

describe("applyPlanEdits", () => {
  it("gives exactly the suggested rows, not edited, without a saved list", () => {
    const applied = apply(null);
    expect(applied.edited).toBe(false);
    expect(applied.rows).toEqual(suggested.map((item) => ({ from: "suggested", item })));
    expect(applied.notTonight).toEqual([]);
    // The extra objects can still be added.
    expect(keys(applied.candidates)).toEqual(["M45", "NGC7000"]);
  });

  it("keeps the saved order", () => {
    const applied = apply(["M31", "moon", "M13"]);
    expect(applied.edited).toBe(true);
    expect(keys(applied.rows)).toEqual(["M31", "moon", "M13"]);
    expect(applied.rows.every((row) => row.from === "suggested")).toBe(true);
  });

  it("drops every row when the saved list is empty, and offers all of them back", () => {
    const applied = apply([]);
    expect(applied.edited).toBe(true);
    expect(applied.rows).toEqual([]);
    expect(keys(applied.candidates)).toEqual(["moon", "jupiter", "M31", "M13", "M45", "NGC7000"]);
  });

  it("draws an added reachable object from the reachable entry, in the saved position", () => {
    const applied = apply(["NGC7000", "jupiter", "M45"]);
    expect(applied.rows).toEqual([
      { from: "reachable", item: reachable[3] },
      { from: "suggested", item: suggested[1] },
      { from: "reachable", item: reachable[2] },
    ]);
    expect(applied.notTonight).toEqual([]);
  });

  it("prefers the suggested row for a key that is both suggested and reachable", () => {
    const applied = apply(["M13"]);
    expect(applied.rows).toEqual([{ from: "suggested", item: suggested[3] }]);
  });

  it("sets a key with no window tonight aside, in saved order, and never draws it", () => {
    // M110 is not reachable; saturn and uranus are not in the suggestion; "moon" is.
    const applied = apply(["M110", "M31", "saturn", "moon", "uranus"]);
    expect(keys(applied.rows)).toEqual(["M31", "moon"]);
    expect(applied.notTonight).toEqual(["M110", "saturn", "uranus"]);
  });

  it("treats a planet or the Moon outside tonight's suggestion as not tonight, even when it was suggested before", () => {
    const withoutMoon = applyPlanEdits({ suggested: suggested.slice(1), saved: ["moon", "M31"], reachable });
    expect(keys(withoutMoon.rows)).toEqual(["M31"]);
    expect(withoutMoon.notTonight).toEqual(["moon"]);
    expect(keys(withoutMoon.candidates)).toEqual(["jupiter", "M13", "M45", "NGC7000"]);
  });

  it("lists a repeated key once", () => {
    const applied = apply(["M31", "M31", "M110", "M110", "moon"]);
    expect(keys(applied.rows)).toEqual(["M31", "moon"]);
    expect(applied.notTonight).toEqual(["M110"]);
  });

  it("offers as candidates exactly the targets that are neither a row nor not-tonight: suggested first, then catalogue order", () => {
    const applied = apply(["M45", "jupiter"]);
    expect(keys(applied.candidates)).toEqual(["moon", "M31", "M13", "NGC7000"]);
    expect(applied.candidates.map((c) => c.from)).toEqual(["suggested", "suggested", "suggested", "reachable"]);
    // Never a row, never a not-tonight key, never twice.
    const all = [...keys(applied.rows), ...applied.notTonight, ...keys(applied.candidates)];
    expect(new Set(all).size).toBe(all.length);
  });

  it("partitions every saved key into a row or a not-tonight key", () => {
    const saved = ["NGC7000", "M110", "jupiter", "venus", "M45", "moon"];
    const applied = apply(saved);
    expect([...keys(applied.rows), ...applied.notTonight].sort()).toEqual([...saved].sort());
  });
});
