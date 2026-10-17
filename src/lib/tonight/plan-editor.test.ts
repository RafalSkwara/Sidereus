import { describe, expect, it } from "vitest";

import { en } from "@/i18n/messages/en";
import { SESSION_PLAN_MAX_TARGETS } from "@/lib/session-plans/schemas";

import { canAdd, editPlan, editorAnnouncement, keyCount, type EditorRow, type PlanEditorState } from "./plan-editor";

const HOUR = 3_600_000;

function row(key: string, bestHour: number, endHour: number): EditorRow {
  return { key, label: key, line: key, bestAt: bestHour * HOUR, windowEnd: endHour * HOUR };
}

const added = (key: string): EditorRow => ({ key, label: key, line: "Window", bestAt: null, windowEnd: null });

const state: PlanEditorState = {
  rows: [row("M31", 22, 26), row("jupiter", 21, 23), row("M13", 23, 27)],
  notTonight: [{ key: "NGC7000", label: "NGC 7000" }],
};

describe("editPlan", () => {
  it("is a no-op at the edges, returning the same state", () => {
    expect(editPlan(state, { type: "move-up", key: "M31" })).toBe(state);
    expect(editPlan(state, { type: "move-down", key: "M13" })).toBe(state);
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

describe("editorAnnouncement", () => {
  const t = en.tonight.pages.plan;
  const say = (action: Parameters<typeof editPlan>[1], from: PlanEditorState) =>
    editorAnnouncement(t, from, action, editPlan(from, action));

  it("adds the order hint when the moved row now ends before the previous target is at its best", () => {
    const late: PlanEditorState = { rows: [row("b", 21, 24), row("a", 25, 26)], notTonight: [] };
    expect(say({ type: "move-down", key: "b" }, late)).toBe(
      `${t.movedTo({ name: "b", position: "2", count: "2" })} ${t.endsBeforePrevious}`,
    );
    // The hint belongs to the moved row only: moving "a" up leaves "a" on top, with no hint of its own.
    expect(say({ type: "move-up", key: "a" }, late)).toBe(t.movedTo({ name: "a", position: "1", count: "2" }));
    // A window that ends exactly at the previous row's best time is not flagged.
    const equal: PlanEditorState = { rows: [row("b", 21, 24), row("a", 24, 26)], notTonight: [] };
    expect(say({ type: "move-down", key: "b" }, equal)).toBe(t.movedTo({ name: "b", position: "2", count: "2" }));
  });
});
