import type { MessageKey } from "@/i18n";
import type { WriteResult } from "@/lib/gear/store";
import { faultFrom, withFault } from "@/lib/observability/fault";
import type { TypedSupabaseClient } from "@/lib/supabase";
import { isTargetKey, type TargetKey } from "@/lib/targets";

/**
 * The edited session plans' data layer (roadmap M-3 S-08, adjustable-session-plan). Follows `@/lib/gear/store.ts`'s
 * privacy rules: database error text never leaves this module, writes return a fixed, value-free message key
 * (`@/i18n`) plus a sanitized `fault` (only the code and status, never for a user-input failure), the read throws an
 * `Error` whose message is such a key and whose `cause` is a sanitized `StoreFault` (never the database error, whose
 * message can echo values), and this module never logs: the caller decides how a failure is traced.
 *
 * One row per (user, site, night) holds the whole ordered list of target keys the user arranged; a reset deletes it.
 * Ownership is enforced by RLS (`user_id` defaults to `auth.uid()`, so writes never send it, and a plan on another
 * user's site is refused by the insert policy); the single-row reads filter by site and night, so they never meet
 * PostgREST's `max_rows`. Whether a key belongs on the night's plan is decided by the app (`plan-edits.ts` when it
 * draws, `plan-window.ts` in the route when a key is added), never by this module.
 */

const SAVE_FAILED: MessageKey = "errors.save.sessionPlan";
const LOAD_FAILED: MessageKey = "errors.load.sessionPlan";

export const sessionPlanStore = {
  /**
   * The caller's saved list for a site and night, in the user's order, or `null` when the plan was never edited (or
   * was reset). An empty list is a saved plan with no targets, not `null`. Throws a fixed message key on a failed
   * read.
   */
  async get(client: TypedSupabaseClient, siteId: string, night: string): Promise<TargetKey[] | null> {
    const { data, error } = await client
      .from("session_plans")
      .select("targets")
      .eq("site_id", siteId)
      .eq("night", night)
      .maybeSingle();
    if (error) {
      throw new Error(LOAD_FAILED, { cause: faultFrom(error) });
    }
    // The table's checks keep every element inside the target grammar; the guard only narrows the type.
    return data ? data.targets.filter(isTargetKey) : null;
  },

  /** Saves the whole list for a site and night, replacing any earlier one (`updated_at` moves, `created_at` stays). */
  async save(
    client: TypedSupabaseClient,
    siteId: string,
    night: string,
    targets: readonly TargetKey[],
  ): Promise<WriteResult> {
    const { error } = await client
      .from("session_plans")
      .upsert(
        { site_id: siteId, night, targets: [...targets], updated_at: new Date().toISOString() },
        { onConflict: "user_id,site_id,night" },
      );
    return error ? { ok: false, message: SAVE_FAILED, ...withFault(error) } : { ok: true };
  },

  /** Deletes the saved list for a site and night, so the suggested plan shows again. No row is still a success. */
  async reset(client: TypedSupabaseClient, siteId: string, night: string): Promise<WriteResult> {
    const { error } = await client.from("session_plans").delete().eq("site_id", siteId).eq("night", night);
    return error ? { ok: false, message: SAVE_FAILED, ...withFault(error) } : { ok: true };
  },
};
