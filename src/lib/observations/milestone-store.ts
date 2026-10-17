import type { MessageKey } from "@/i18n";
import { faultFrom } from "@/lib/observability/fault";
import { isMilestoneKey, type MilestoneKey } from "@/lib/progress/milestones";
import type { TypedSupabaseClient } from "@/lib/supabase";

/**
 * The stored milestones' data layer (roadmap M-3 S-06). Follows `store.ts`: database error text never leaves this
 * module, failures throw an `Error` whose message is a fixed message key and whose `cause` is a sanitized `StoreFault`
 * holding only the database error's code (as `listSeenEntries` does), and this module never logs: the caller decides
 * how a failure is traced.
 *
 * The table holds each milestone once per user (`observing_milestones_user_key_key`), so the milestone reads are
 * small (at most one row per `MILESTONES` key) and never meet PostgREST's `max_rows`.
 */

const LOAD_FAILED: MessageKey = "errors.load.observations";

/** One milestone to store: its key and the observing night it was reached on (`YYYY-MM-DD`). */
export interface MilestoneRecordInput {
  key: MilestoneKey;
  reachedNight: string;
}

export const milestoneStore = {
  /**
   * The caller's stored milestones, each key with its `reached_night`. RLS limits the read to the caller's rows
   * (at most one per key, so at most 11), and the order by key keeps the result deterministic. A key outside the
   * fixed set (a row from a newer app version) is dropped.
   */
  async listReached(client: TypedSupabaseClient): Promise<Map<MilestoneKey, string>> {
    const { data, error } = await client.from("observing_milestones").select("key, reached_night").order("key");
    if (error) {
      throw new Error(LOAD_FAILED, { cause: faultFrom(error) });
    }
    const reached = new Map<MilestoneKey, string>();
    for (const row of data) {
      if (isMilestoneKey(row.key)) {
        reached.set(row.key, row.reached_night);
      }
    }
    return reached;
  },

  /**
   * Stores milestones the caller has reached, ignoring any already stored (the first `reached_night` stays), and
   * returns the keys this call actually inserted, which is what the save celebrates. An empty input makes no
   * request. `user_id` defaults to `auth.uid()`.
   */
  async record(client: TypedSupabaseClient, states: readonly MilestoneRecordInput[]): Promise<MilestoneKey[]> {
    if (states.length === 0) {
      return [];
    }
    const { data, error } = await client
      .from("observing_milestones")
      .upsert(
        states.map((state) => ({ key: state.key, reached_night: state.reachedNight })),
        { onConflict: "user_id,key", ignoreDuplicates: true },
      )
      .select("key");
    if (error) {
      throw new Error(LOAD_FAILED, { cause: faultFrom(error) });
    }
    return data.map((row) => row.key).filter(isMilestoneKey);
  },
};
