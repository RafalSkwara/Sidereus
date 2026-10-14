/**
 * The order hint of an edited Session plan (adjustable-session-plan, D2 b): the list is in the user's order and every row
 * keeps its own window and best time, so a row can end before the row above it peaks. The hint says so, advisory only.
 * Pure and island-safe (no imports): the timeline and the editor read the same rule.
 */

/** What the hint needs of a row: its best time and the end of its best window, epoch ms. */
export interface PlanOrderRow {
  bestAt: number;
  windowEnd: number;
}

/**
 * Per row: `true` when it is not the first and its best window ends before the previous row's best time (equal times
 * are not flagged). The first row never is; the result has one entry per row.
 */
export function orderHints(rows: readonly PlanOrderRow[]): boolean[] {
  return rows.map((row, i) => i > 0 && row.windowEnd < rows[i - 1].bestAt);
}
