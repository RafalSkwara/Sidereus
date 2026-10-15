import { CODE_SHAPE } from "@/lib/observability/log-failure";
import type { TypedSupabaseClient } from "@/lib/supabase";

/**
 * What a failed read keeps: the database's error code and the error class's name, each only when it has the shape of
 * one (see `shaped`). Never the message, which can echo a value.
 */
export interface PlanReadFault {
  code?: string;
  name?: string;
}

/** An error class's name as an identifier (`TypeError`, `AuthRetryableFetchError`); the same shape the log helper accepts. */
const NAME_SHAPE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;

/** The shaped `code` and `name` of a caught value: a field is left out unless it has its own shape. */
function shaped(error: unknown): PlanReadFault {
  const fault: PlanReadFault = {};
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (typeof code === "string" && CODE_SHAPE.test(code)) {
    fault.code = code;
  }
  if (error instanceof Error && NAME_SHAPE.test(error.name)) {
    fault.name = error.name;
  }
  return fault;
}

/**
 * The account plan's data layer (roadmap F-01). The only code that queries `account_plans`; the table is read-only
 * for users (writes are the operator's), so there is no write here. Follows `@/lib/gear/store.ts`'s privacy rules:
 * database error text never leaves this module and it never logs; a failed read is reported as
 * `{ error: true, code?, name? }` and never thrown, so the caller can fail closed. `code` is the PostgREST or Postgres
 * error code (such as `42501`) and `name` the error class's name (`TypeError`, `AuthRetryableFetchError`), kept apart so
 * a long name is never mistaken for a code; each is present only when it has that shape, and never the message.
 */
export const accountPlanStore = {
  /**
   * The stored plan of `userId`, as the database holds it (unvalidated: `planFrom` decides what it means). A user
   * without a row has `plan: undefined`. Row-level security already narrows the read to the caller's own row.
   */
  async read(
    client: TypedSupabaseClient,
    userId: string,
  ): Promise<{ plan: unknown } | ({ error: true } & PlanReadFault)> {
    try {
      const { data, error } = await client.from("account_plans").select("plan").eq("user_id", userId).maybeSingle();
      if (error) {
        return { error: true, ...shaped(error) };
      }
      return { plan: data?.plan };
    } catch (error) {
      // A thrown client error is reported like a failed read; the error text stays here (see the privacy rules above).
      return { error: true, ...shaped(error) };
    }
  },
};
