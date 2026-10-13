import type { TypedSupabaseClient } from "@/lib/supabase";

/**
 * The account plan's data layer (roadmap F-01). The only code that queries `account_plans`; the table is read-only
 * for users (writes are the operator's), so there is no write here. Follows `@/lib/gear/store.ts`'s privacy rules:
 * database error text never leaves this module and it never logs; a failed read is reported as
 * `{ error: true, code }` and never thrown, so the caller can fail closed. `code` is the PostgREST error code (a fixed
 * code such as `42501`), else the error's `name`: never its message, which can echo a value.
 */
export const accountPlanStore = {
  /**
   * The stored plan of `userId`, as the database holds it (unvalidated: `planFrom` decides what it means). A user
   * without a row has `plan: undefined`. Row-level security already narrows the read to the caller's own row.
   */
  async read(client: TypedSupabaseClient, userId: string): Promise<{ plan: unknown } | { error: true; code: string }> {
    try {
      const { data, error } = await client.from("account_plans").select("plan").eq("user_id", userId).maybeSingle();
      if (error) {
        return { error: true, code: error.code || error.name };
      }
      return { plan: data?.plan };
    } catch (error) {
      // A thrown client error is reported like a failed read; the error text stays here (see the privacy rules above).
      return { error: true, code: error instanceof Error ? error.name : typeof error };
    }
  },
};
