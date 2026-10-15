import type { LogEntry } from "@/lib/engine";
import {
  MILESTONES,
  milestonesOf,
  newlyReached,
  type MilestoneKey,
  type MilestoneState,
} from "@/lib/progress/milestones";
import { logFailure, type FailureStep } from "@/lib/observability/log-failure";
import { observingProgress } from "@/lib/progress/progress";

import type { MilestoneRecordInput } from "./milestone-store";

/**
 * Recording at save (roadmap M-3 S-06, observing-milestones Phase 3): what a save of a log entry reached is stored,
 * and what it newly stored is handed back for the page to celebrate. This does I/O through its seams, so it sits
 * beside `store.ts` and `redirect.ts`, not in the pure `src/lib/progress/`.
 *
 * The order inside a save (plan, "Order inside a route"):
 * - A counting save (a create or an edit rated `LOG_PENALTY_MIN_RATING` or above): read `before`, write the entry,
 *   read `after` (even if `before` failed), record `reached(before) ∪ reached(after)` in one call, and celebrate
 *   `newlyReached(before, after) ∩ inserted` in `MILESTONES` order. Without `before` the save cannot tell new from
 *   old, so nothing is celebrated.
 * - A save that cannot count (an edit to a lower rating, a delete): read `before`, record `reached(before)`, then
 *   write. It never reads `after` and never celebrates; neither can reach anything.
 *
 * A failed milestone read or record never blocks or fails the write: it is traced (`logMilestoneFailure`) and the
 * save simply celebrates nothing. A failed write returns the write's own result unchanged, and in a counting save
 * nothing is recorded after it.
 */

/** The steps `logMilestoneFailure` can name; each is a fixed word, so the logged line is fixed too. */
export type MilestoneStep = "read" | "record" | "list" | "seen";

/**
 * The page's seen read is S-05's (observing progress), so its step names that feature, not milestones.
 */
const FAILURE_STEP_OF: Record<MilestoneStep, FailureStep> = {
  read: "milestones.read",
  record: "milestones.record",
  list: "milestones.list",
  seen: "progress.seen",
};

/**
 * Traces a failed milestone step through the shared helper: its fixed line, the error's (or its cause's) name and a
 * shaped cause code, never a message (an error message could carry a coordinate or a value, which never go into logs).
 */
export function logMilestoneFailure(step: MilestoneStep, error: unknown): void {
  logFailure(FAILURE_STEP_OF[step], error);
}

export interface ReachedBySaveOptions<Result extends { ok: boolean }> {
  /** Every entry that can count as seen, as `observationStore.listSeenEntries` reads them. */
  read: () => Promise<LogEntry[]>;
  /** Stores the milestones (ignoring any already stored) and returns the keys it actually inserted. */
  record: (states: MilestoneRecordInput[]) => Promise<MilestoneKey[]>;
  /** Whether this save can reach something: a create or an edit rated `LOG_PENALTY_MIN_RATING` or above. */
  counts: boolean;
  /** The save itself; its result comes back unchanged. */
  write: () => Promise<Result>;
}

/** The milestones a log has reached, with the night each was reached on. */
function reachedStates(entries: readonly LogEntry[]): MilestoneState[] {
  return milestonesOf(observingProgress(entries));
}

/** `reached(before) ∪ reached(after)`, one state per key in `MILESTONES` order, the `after` night where both have it. */
function toRecord(...stateLists: readonly (readonly MilestoneState[])[]): MilestoneRecordInput[] {
  const nights = new Map<MilestoneKey, string>();
  for (const states of stateLists) {
    for (const state of states) {
      if (state.reachedNight !== null) {
        nights.set(state.key, state.reachedNight);
      }
    }
  }
  return MILESTONES.flatMap(({ key }) => {
    const reachedNight = nights.get(key);
    return reachedNight === undefined ? [] : [{ key, reachedNight }];
  });
}

/** A seam call whose failure is traced, not thrown: `null` for a failure. */
async function traced<T>(step: MilestoneStep, call: () => Promise<T>): Promise<T | null> {
  try {
    return await call();
  } catch (error) {
    logMilestoneFailure(step, error);
    return null;
  }
}

/**
 * Runs a save with its milestone work around it (see the module comment for the order). Returns the write's own
 * `result` and the keys to celebrate: only a counting save that read its `before`, wrote, and had `record` insert
 * a key it newly reached.
 */
export async function reachedBySave<Result extends { ok: boolean }>({
  read,
  record,
  counts,
  write,
}: ReachedBySaveOptions<Result>): Promise<{ result: Result; celebrate: MilestoneKey[] }> {
  const beforeEntries = await traced("read", read);
  const before = beforeEntries === null ? null : reachedStates(beforeEntries);

  if (!counts) {
    // Store what the log has reached before this save can take it away (an edit to 1-2, a delete).
    if (before !== null) {
      const states = toRecord(before);
      if (states.length > 0) {
        await traced("record", () => record(states));
      }
    }
    return { result: await write(), celebrate: [] };
  }

  const result = await write();
  if (!result.ok) {
    return { result, celebrate: [] };
  }

  // Read after the write even when `before` failed, so the after-state is still stored.
  const afterEntries = await traced("read", read);
  const after = afterEntries === null ? null : reachedStates(afterEntries);

  const states = toRecord(before ?? [], after ?? []);
  if (states.length === 0) {
    return { result, celebrate: [] };
  }
  const inserted = await traced("record", () => record(states));
  if (inserted === null || before === null || after === null) {
    return { result, celebrate: [] };
  }

  const newly = new Set(newlyReached(before, after));
  const stored = new Set(inserted);
  return { result, celebrate: MILESTONES.map(({ key }) => key).filter((key) => newly.has(key) && stored.has(key)) };
}
