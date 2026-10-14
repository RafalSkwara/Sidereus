/**
 * Applies a user's saved list to the night (adjustable-session-plan): the one rule that decides which targets are rows of
 * the Session plan, in which order, and what may be added. Pure: no clock, no I/O, no engine; a row exists only when the
 * engine's own rule gave the key a window tonight, because every row comes from `suggested` (the plan the build made) or
 * from `reachable` (the ranking's scored objects, each with a best window), never from the saved list itself.
 */

/** A row's origin: tonight's suggested plan, or an object the telescope can reach (the ranking's `reachable`). */
export type PlanSource<S, K> = { from: "suggested"; item: S } | { from: "reachable"; item: K };

export interface ApplyPlanEditsInput<S extends { key: string }, K extends { key: string }> {
  /** Tonight's suggested rows: the Moon, the listed planets and the ranking's top deep-sky objects. */
  suggested: readonly S[];
  /** The saved list of target keys in the user's order, or `null` when there is none. */
  saved: readonly string[] | null;
  /** Every deep-sky object the telescope can reach with a window tonight, in catalogue order. */
  reachable: readonly K[];
}

export interface AppliedPlan<S, K> {
  /** The plan's rows in order: exactly the suggested ones without a saved list, else the saved keys that have a window. */
  rows: PlanSource<S, K>[];
  /** Saved keys with no window tonight, in saved order: never drawn, kept until the user removes them. */
  notTonight: string[];
  /** What "add" offers: every suggested or reachable target that is not a row, suggested first, then catalogue order. */
  candidates: PlanSource<S, K>[];
  /** A saved list was applied (it may be empty). */
  edited: boolean;
}

export function applyPlanEdits<S extends { key: string }, K extends { key: string }>(
  input: ApplyPlanEditsInput<S, K>,
): AppliedPlan<S, K> {
  const { suggested, saved, reachable } = input;
  const suggestedByKey = new Map(suggested.map((item) => [item.key, item]));
  const reachableByKey = new Map(reachable.map((item) => [item.key, item]));

  const rows: PlanSource<S, K>[] = [];
  const notTonight: string[] = [];
  if (saved === null) {
    rows.push(...suggested.map((item): PlanSource<S, K> => ({ from: "suggested", item })));
  } else {
    const seen = new Set<string>();
    for (const key of saved) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const fromSuggested = suggestedByKey.get(key);
      const fromReachable = reachableByKey.get(key);
      if (fromSuggested !== undefined) {
        rows.push({ from: "suggested", item: fromSuggested });
      } else if (fromReachable !== undefined) {
        rows.push({ from: "reachable", item: fromReachable });
      } else {
        notTonight.push(key);
      }
    }
  }

  const inRows = new Set(rows.map((row) => row.item.key));
  const candidates: PlanSource<S, K>[] = [
    ...suggested.filter((item) => !inRows.has(item.key)).map((item): PlanSource<S, K> => ({ from: "suggested", item })),
    ...reachable
      .filter((item) => !inRows.has(item.key) && !suggestedByKey.has(item.key))
      .map((item): PlanSource<S, K> => ({ from: "reachable", item })),
  ];
  return { rows, notTonight, candidates, edited: saved !== null };
}
