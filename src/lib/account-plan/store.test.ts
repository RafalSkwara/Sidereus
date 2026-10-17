import { describe, expect, it } from "vitest";

import type { TypedSupabaseClient } from "@/lib/supabase";

import { accountPlanStore } from "./store";

/**
 * A failed read reports the error's code and name apart, each only in its own shape, and never the message
 * (finder-chart review F4, error-visibility Phase 2). The query itself is covered by `tests/db/account-plans.test.ts`;
 * here the client is a stub that answers, or throws, as given.
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

  /** An error as the client returns it: an `Error` carrying a PostgREST code and a message that can echo a value. */
  function failure(name: string, code: string, message: string): Error {
    return Object.assign(new Error(message), { name, code });
  }

  it("reports the database error's code and name apart, never its message", async () => {
    const refused = clientAnswering(() =>
      Promise.resolve({
        data: null,
        error: failure("PostgrestError", "42501", "permission denied for table account_plans"),
      }),
    );
    expect(await accountPlanStore.read(refused, USER_ID)).toEqual({
      error: true,
      code: "42501",
      name: "PostgrestError",
    });
  });

  it("reports the name alone when the code is empty, as for a failed fetch", async () => {
    const unreachable = clientAnswering(() =>
      Promise.resolve({ data: null, error: failure("PostgrestError", "", "TypeError: fetch failed") }),
    );
    expect(await accountPlanStore.read(unreachable, USER_ID)).toEqual({ error: true, name: "PostgrestError" });
  });

  it("keeps a long class name as a name, never as a code", async () => {
    const authFetch = clientAnswering(() =>
      Promise.resolve({ data: null, error: failure("AuthRetryableFetchError", "", "fetch failed for a@example.test") }),
    );
    expect(await accountPlanStore.read(authFetch, USER_ID)).toEqual({ error: true, name: "AuthRetryableFetchError" });
    // A code that does not have a code's shape is dropped, not logged as something else.
    const odd = clientAnswering(() =>
      Promise.resolve({ data: null, error: failure("PostgrestError", "has a space or is too long", "x") }),
    );
    expect(await accountPlanStore.read(odd, USER_ID)).toEqual({ error: true, name: "PostgrestError" });
  });

  it("reports a thrown error by its name only", async () => {
    const thrown = clientAnswering(() => Promise.reject(new TypeError("secret detail")));
    expect(await accountPlanStore.read(thrown, USER_ID)).toEqual({ error: true, name: "TypeError" });
    const coded = clientAnswering(() =>
      Promise.reject(failure("DriverError", "08006", "connection to a@example.test")),
    );
    expect(await accountPlanStore.read(coded, USER_ID)).toEqual({ error: true, code: "08006", name: "DriverError" });
  });

  it("takes a name only from an Error and drops a name that is not an identifier", async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a client can throw a non-Error.
    const text = clientAnswering(() => Promise.reject("a string"));
    expect(await accountPlanStore.read(text, USER_ID)).toEqual({ error: true });
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a client can throw a non-Error.
    const plain = clientAnswering(() => Promise.reject({ name: "PostgrestError", code: "42501", message: "x" }));
    expect(await accountPlanStore.read(plain, USER_ID)).toEqual({ error: true, code: "42501" });
    const sentence = clientAnswering(() =>
      Promise.reject(Object.assign(new Error("x"), { name: "failed for a@b.test" })),
    );
    expect(await accountPlanStore.read(sentence, USER_ID)).toEqual({ error: true });
  });
});
