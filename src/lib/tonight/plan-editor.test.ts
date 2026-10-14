import { describe, expect, it } from "vitest";

import { SESSION_PLAN_MAX_TARGETS } from "@/lib/session-plans/schemas";

import {
  canAdd,
  editPlan,
  editorHints,
  keyCount,
  savedKeys,
  type EditorRow,
  type PlanEditorState,
} from "./plan-editor";

const HOUR = 3_600_000;

function row(key: string, bestHour: number, endHour: number): EditorRow {
  return { key, label: key, line: key, bestAt: bestHour * HOUR, windowEnd: endHour * HOUR };
}

const added = (key: string): EditorRow => ({ key, label: key, line: "Window", bestAt: null, windowEnd: null });

const state: PlanEditorState = {
  rows: [row("M31", 22, 26), row("jupiter", 21, 23), row("M13", 23, 27)],
  notTonight: [{ key: "NGC7000", label: "NGC 7000" }],
};

const keys = (s: PlanEditorState) => s.rows.map((r) => r.key);

describe("editPlan: move", () => {
  it("moves a row up and down by one place", () => {
    expect(keys(editPlan(state, { type: "move-up", key: "jupiter" }))).toEqual(["jupiter", "M31", "M13"]);
    expect(keys(editPlan(state, { type: "move-down", key: "M31" }))).toEqual(["jupiter", "M31", "M13"]);
  });

  it("is a no-op at the edges, returning the same state", () => {
    expect(editPlan(state, { type: "move-up", key: "M31" })).toBe(state);
    expect(editPlan(state, { type: "move-down", key: "M13" })).toBe(state);
  });

  it("is a no-op for a key that is not a row, and never moves a notTonight entry", () => {
    expect(editPlan(state, { type: "move-up", key: "saturn" })).toBe(state);
    expect(editPlan(state, { type: "move-down", key: "NGC7000" })).toBe(state);
  });

  it("does not change the state it was given", () => {
    const before = structuredClone(state);
    editPlan(state, { type: "move-up", key: "jupiter" });
    expect(state).toEqual(before);
  });
});

describe("editPlan: remove", () => {
  it("removes a row, keeping the others in order", () => {
    expect(keys(editPlan(state, { type: "remove", key: "jupiter" }))).toEqual(["M31", "M13"]);
  });

  it("removes a notTonight entry", () => {
    const next = editPlan(state, { type: "remove", key: "NGC7000" });
    expect(next.notTonight).toEqual([]);
    expect(keys(next)).toEqual(keys(state));
  });

  it("is a no-op for an unknown key, and can empty the list", () => {
    expect(editPlan(state, { type: "remove", key: "saturn" })).toBe(state);
    const empty = ["M31", "jupiter", "M13"].reduce((s, key) => editPlan(s, { type: "remove", key }), state);
    expect(empty.rows).toEqual([]);
  });
});

describe("editPlan: add", () => {
  it("appends a target", () => {
    expect(keys(editPlan(state, { type: "add", row: added("M42") }))).toEqual(["M31", "jupiter", "M13", "M42"]);
  });

  it("never adds a key twice, as a row or as a notTonight entry", () => {
    expect(editPlan(state, { type: "add", row: added("M31") })).toBe(state);
    expect(editPlan(state, { type: "add", row: added("NGC7000") })).toBe(state);
  });

  it("holds at most SESSION_PLAN_MAX_TARGETS keys, rows and notTonight together", () => {
    let full: PlanEditorState = { rows: [], notTonight: [{ key: "NGC7000", label: "NGC 7000" }] };
    for (let n = 1; n < SESSION_PLAN_MAX_TARGETS; n++) {
      full = editPlan(full, { type: "add", row: added(`M${String(n)}`) });
    }
    expect(keyCount(full)).toBe(SESSION_PLAN_MAX_TARGETS);
    expect(canAdd(full)).toBe(false);
    expect(editPlan(full, { type: "add", row: added("M99") })).toBe(full);
    expect(canAdd(editPlan(full, { type: "remove", key: "M1" }))).toBe(true);
  });
});

describe("savedKeys", () => {
  it("is the rows in order, then the targets with no window tonight", () => {
    expect(savedKeys(state)).toEqual(["M31", "jupiter", "M13", "NGC7000"]);
    expect(savedKeys(editPlan(state, { type: "move-up", key: "M13" }))).toEqual(["M31", "M13", "jupiter", "NGC7000"]);
  });
});

describe("editorHints", () => {
  it("flags a row whose window ends before the row above is at its best, and recomputes after a move", () => {
    const late: PlanEditorState = { rows: [row("a", 25, 26), row("b", 21, 24)], notTonight: [] };
    expect(editorHints(late.rows)).toEqual([false, true]);
    expect(editorHints(editPlan(late, { type: "move-up", key: "b" }).rows)).toEqual([false, false]);
  });

  it("does not flag equal times", () => {
    expect(editorHints([row("a", 24, 26), row("b", 21, 24)])).toEqual([false, false]);
  });

  it("never flags a row without times, and never guesses from it", () => {
    expect(editorHints([row("a", 25, 26), added("b")])).toEqual([false, false]);
    expect(editorHints([added("a"), row("b", 21, 24)])).toEqual([false, false]);
  });
});
