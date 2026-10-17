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

/** An error as the client returns it: an `Error` carrying a PostgREST code and a message that can echo a value. */
function failure(name: string, code: string, message: string): Error {
  return Object.assign(new Error(message), { name, code });
}

/** A client that throws a value that is not an `Error`, which a driver can do. */
function rejecting(value: unknown): () => Promise<unknown> {
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- a client can throw a non-Error.
  return () => Promise.reject(value);
}

describe("accountPlanStore.read", () => {
  it("returns the stored plan, and reports a failure by code and name apart, never by message", async () => {
    const cases: { name: string; answer: () => Promise<unknown>; expected: object }[] = [
      {
        name: "a stored plan",
        answer: () => Promise.resolve({ data: { plan: "full" }, error: null }),
        expected: { plan: "full" },
      },
      {
        name: "a user without a row",
        answer: () => Promise.resolve({ data: null, error: null }),
        expected: { plan: undefined },
      },
      {
        name: "a database error: code and name apart",
        answer: () =>
          Promise.resolve({
            data: null,
            error: failure("PostgrestError", "42501", "permission denied for table account_plans"),
          }),
        expected: { error: true, code: "42501", name: "PostgrestError" },
      },
      {
        name: "an empty code, as for a failed fetch: the name alone",
        answer: () => Promise.resolve({ data: null, error: failure("PostgrestError", "", "TypeError: fetch failed") }),
        expected: { error: true, name: "PostgrestError" },
      },
      {
        name: "a long class name stays a name, never a code",
        answer: () =>
          Promise.resolve({
            data: null,
            error: failure("AuthRetryableFetchError", "", "fetch failed for a@example.test"),
          }),
        expected: { error: true, name: "AuthRetryableFetchError" },
      },
      {
        name: "a code without a code's shape is dropped",
        answer: () =>
          Promise.resolve({ data: null, error: failure("PostgrestError", "has a space or is too long", "x") }),
        expected: { error: true, name: "PostgrestError" },
      },
      {
        name: "a thrown error: its name only",
        answer: () => Promise.reject(new TypeError("secret detail")),
        expected: { error: true, name: "TypeError" },
      },
      {
        name: "a thrown error with a code",
        answer: () => Promise.reject(failure("DriverError", "08006", "connection to a@example.test")),
        expected: { error: true, code: "08006", name: "DriverError" },
      },
      { name: "a thrown string", answer: rejecting("a string"), expected: { error: true } },
      {
        name: "a thrown plain object: a name only from an Error",
        answer: rejecting({ name: "PostgrestError", code: "42501", message: "x" }),
        expected: { error: true, code: "42501" },
      },
      {
        name: "a name that is not an identifier is dropped",
        answer: () => Promise.reject(Object.assign(new Error("x"), { name: "failed for a@b.test" })),
        expected: { error: true },
      },
    ];
    // Non-vacuity: every answer shape is tried.
    expect(cases).toHaveLength(11);
    for (const { name, answer, expected } of cases) {
      expect(await accountPlanStore.read(clientAnswering(answer), USER_ID), name).toEqual(expected);
    }
  });
});
