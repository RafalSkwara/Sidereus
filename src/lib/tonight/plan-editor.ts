import type { Messages } from "@/i18n";
import { SESSION_PLAN_MAX_TARGETS } from "@/lib/session-plans/schemas";
import { orderHints } from "@/lib/tonight/plan-order";

/**
 * The Session plan editor's state (adjustable-session-plan, D6, F7): move, remove and add as one pure reducer, so the
 * React island stays thin and Vitest's node environment can test it. Island-safe: it imports only the shared limit
 * (`schemas.ts`, zod and the key grammar) and the order hint's pure module, never the catalogue or the clock.
 *
 * The state is the two lists the editor shows: the rows in the user's order, and the saved targets with no window
 * tonight (`notTonight`, D4), which stay on the list until the user removes them. A save posts the rows in order, then
 * the `notTonight` keys (`savedKeys`). Every no-op (an edge move, a key that is not there, a duplicate add, a full list)
 * returns the same state object, so a caller can tell a change by identity.
 *
 * Island-safe also for its wording: `editorAnnouncement` takes the page's own `tonight.pages.plan` messages as an
 * argument (the island already holds them), so it stays pure and needs no locale here.
 */

/** One row of the editor: a plan row as the page words it, or a target the user just added. */
export interface EditorRow {
  key: string;
  /** "M31 · Andromeda Galaxy": what the row is called (the timeline's name). */
  label: string;
  /** The row's visible line: "Best 22:40 · window 21:40–23:10 · SW, 45°", or "Window 21:40–23:10" for an added one. */
  line: string;
  /** Peak time and the end of the best window, epoch ms; `null` for a target added in the editor (it has neither here). */
  bestAt: number | null;
  windowEnd: number | null;
}

/** A saved target with no window tonight. */
export interface EditorEntry {
  key: string;
  label: string;
}

export interface PlanEditorState {
  rows: EditorRow[];
  notTonight: EditorEntry[];
}

export type PlanEditorAction =
  | { type: "move-up"; key: string }
  | { type: "move-down"; key: string }
  | { type: "remove"; key: string }
  | { type: "add"; row: EditorRow };

/** How many keys the state holds in all: the rows and the `notTonight` entries (the table's limit counts both). */
export function keyCount(state: PlanEditorState): number {
  return state.rows.length + state.notTonight.length;
}

/** Whether one more target fits. */
export function canAdd(state: PlanEditorState): boolean {
  return keyCount(state) < SESSION_PLAN_MAX_TARGETS;
}

/** What a save posts, in order: the rows, then the saved targets with no window tonight. */
export function savedKeys(state: PlanEditorState): string[] {
  return [...state.rows.map((row) => row.key), ...state.notTonight.map((entry) => entry.key)];
}

/**
 * The order hint (D2 b) per row, by the timeline's own rule (`orderHints`): a row whose window ends before the row above
 * is at its best. A target added in the editor has no times here, so a pair that lacks the row above's best time or this
 * row's window end is never flagged; the saved page words it from the server's times.
 */
export function editorHints(rows: readonly EditorRow[]): boolean[] {
  return rows.map((row, i) => {
    const above = i > 0 ? rows[i - 1] : undefined;
    const aboveBest = above?.bestAt ?? null;
    if (aboveBest === null || row.windowEnd === null) {
      return false;
    }
    // `orderHints` reads only the row above's `bestAt` and this row's `windowEnd`; the other two fill its shape.
    return orderHints([
      { bestAt: aboveBest, windowEnd: above?.windowEnd ?? aboveBest },
      { bestAt: row.bestAt ?? row.windowEnd, windowEnd: row.windowEnd },
    ])[1];
  });
}

function swap(rows: readonly EditorRow[], from: number, to: number): EditorRow[] {
  const next = [...rows];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function editPlan(state: PlanEditorState, action: PlanEditorAction): PlanEditorState {
  switch (action.type) {
    case "move-up":
    case "move-down": {
      const index = state.rows.findIndex((row) => row.key === action.key);
      const to = action.type === "move-up" ? index - 1 : index + 1;
      if (index < 0 || to < 0 || to >= state.rows.length) {
        return state;
      }
      return { ...state, rows: swap(state.rows, index, to) };
    }
    case "remove": {
      if (state.rows.some((row) => row.key === action.key)) {
        return { ...state, rows: state.rows.filter((row) => row.key !== action.key) };
      }
      if (state.notTonight.some((entry) => entry.key === action.key)) {
        return { ...state, notTonight: state.notTonight.filter((entry) => entry.key !== action.key) };
      }
      return state;
    }
    case "add": {
      const present =
        state.rows.some((row) => row.key === action.row.key) ||
        state.notTonight.some((entry) => entry.key === action.row.key);
      if (present || !canAdd(state)) {
        return state;
      }
      return { ...state, rows: [...state.rows, action.row] };
    }
  }
}

/**
 * Whether the list is the one the editor opened with (F10 c): the same keys in the same order. Save stays disabled
 * then, so saving an untouched suggestion never pins it as the user's list (D1).
 */
export function isUnchanged(initial: PlanEditorState, state: PlanEditorState): boolean {
  const before = savedKeys(initial);
  const after = savedKeys(state);
  return before.length === after.length && before.every((key, i) => key === after[i]);
}

type PlanText = Messages["tonight"]["pages"]["plan"];

/**
 * What the editor's status region says after an action (F6): a Move gives the row's new position of the count, plus the
 * order hint (D2 b) when the moved row now ends before the previous target is at its best; Remove and Add name the
 * target. A no-op (`after` is `before`, as `editPlan` returns for an edge move or a duplicate) says nothing (`null`).
 */
export function editorAnnouncement(
  t: PlanText,
  before: PlanEditorState,
  action: PlanEditorAction,
  after: PlanEditorState,
): string | null {
  if (after === before) {
    return null;
  }
  switch (action.type) {
    case "move-up":
    case "move-down": {
      const index = after.rows.findIndex((row) => row.key === action.key);
      if (index < 0) {
        return null;
      }
      const moved = t.movedTo({
        name: after.rows[index].label,
        position: String(index + 1),
        count: String(after.rows.length),
      });
      return editorHints(after.rows)[index] ? `${moved} ${t.endsBeforePrevious}` : moved;
    }
    case "remove": {
      const entry = [...before.rows, ...before.notTonight].find((candidate) => candidate.key === action.key);
      return entry ? t.removed({ name: entry.label }) : null;
    }
    case "add":
      return t.added({ name: action.row.label });
  }
}
