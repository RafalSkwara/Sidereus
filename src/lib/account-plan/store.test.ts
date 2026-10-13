import { describe, expect, it } from "vitest";

import type { TypedSupabaseClient } from "@/lib/supabase";

import { accountPlanStore } from "./store";

/**
 * A failed read reports a fixed code or name and never the message (finder-chart review F4). The query itself is
 * covered by `tests/db/account-plans.test.ts`; here the client is a stub that answers, or throws, as given.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";

function clientAnswering(answer: () => Promise<unknown>): TypedSupabaseClient {
  const query = { select: () => query, eq: () => query, maybeSingle: answer };
  return { from: () => query } as unknown as TypedSupabaseClient;
}

describe("accountPlanStore.read", () => {
  it("returns the stored plan, and none for a user without a row", async () => {
    const full = clientAnswering(() => Promise.resolve({ data: { plan: "full" }, error: null }));
    expect(await accountPlanStore.read(full, USER_ID)).toEqual({ plan: "full" });
    const none = clientAnswering(() => Promise.resolve({ data: null, error: null }));
    expect(await accountPlanStore.read(none, USER_ID)).toEqual({ plan: undefined });
  });

  it("reports the database error's code, never its message", async () => {
    const refused = clientAnswering(() =>
      Promise.resolve({
        data: null,
        error: { code: "42501", name: "PostgrestError", message: "permission denied for table account_plans" },
      }),
    );
    expect(await accountPlanStore.read(refused, USER_ID)).toEqual({ error: true, code: "42501" });
  });

  it("falls back to the error's name when the code is empty, as for a failed fetch", async () => {
    const unreachable = clientAnswering(() =>
      Promise.resolve({ data: null, error: { code: "", name: "PostgrestError", message: "TypeError: fetch failed" } }),
    );
    expect(await accountPlanStore.read(unreachable, USER_ID)).toEqual({ error: true, code: "PostgrestError" });
  });

  it("reports a thrown error by its name only", async () => {
    const thrown = clientAnswering(() => Promise.reject(new TypeError("secret detail")));
    expect(await accountPlanStore.read(thrown, USER_ID)).toEqual({ error: true, code: "TypeError" });
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a client can throw a non-Error.
    const odd = clientAnswering(() => Promise.reject("a string"));
    expect(await accountPlanStore.read(odd, USER_ID)).toEqual({ error: true, code: "string" });
  });
});
