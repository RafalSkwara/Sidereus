import type { TypedSupabaseClient } from "@/lib/supabase";

/**
 * A stand-in for the Supabase client in store tests (error-visibility, Phase 2): a chainable, awaitable query builder
 * that answers every request with the result chosen for its table (or RPC name). No network, no Supabase.
 */

/** What a PostgREST request resolves to. */
export interface FakeResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

/** Text a real database error echoes: the submitted coordinates and an email. */
export const COORDS = "52.2297,21.0122";
export const EMAIL = "ada.lovelace@example.test";
/** Matches any trace of `COORDS` or `EMAIL`. */
export const LEAK = /52\.2297|21\.0122|ada\.lovelace|example\.test/;

/**
 * A PostgREST-shaped error whose message, details and hint all hold the submitted values, as a failing insert's do.
 * `status` is set only when given (supabase-js leaves it on the response, but a proxy's error can carry one).
 */
export function leakyPostgrestError(code: string, status?: number) {
  return {
    name: "PostgrestError",
    message: `new row violates a constraint: Failing row contains (${COORDS}, ${EMAIL})`,
    details: `Key (latitude_deg)=(${COORDS}) belongs to ${EMAIL}`,
    hint: EMAIL,
    code,
    ...(status === undefined ? {} : { status }),
  };
}

/**
 * `target` is the table (or RPC name); `calls` are the builder methods chained so far, in order (`["update", "eq",
 * "select"]`), so a test can answer the read and the write of one table differently.
 */
type Resolve = FakeResult | ((target: string, calls: readonly string[]) => FakeResult);

/**
 * A client whose `from(table)` and `rpc(name)` queries (and every chained filter, order and range) resolve to
 * `resolve`, or to `resolve(table, calls)` when it is a function. Missing fields read as `data: null`, `error: null`.
 */
export function fakeClient(resolve: Resolve): TypedSupabaseClient {
  const answer = (target: string, calls: readonly string[]): Promise<Required<FakeResult>> => {
    const result = typeof resolve === "function" ? resolve(target, calls) : resolve;
    return Promise.resolve({ data: result.data ?? null, error: result.error ?? null, count: result.count ?? null });
  };
  const builder = (target: string, calls: readonly string[]): unknown =>
    new Proxy(
      {},
      {
        get(_object, key) {
          if (key === "then") {
            return (onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) =>
              answer(target, calls).then(onFulfilled, onRejected);
          }
          return () => builder(target, [...calls, String(key)]);
        },
      },
    );
  return {
    from: (table: string) => builder(table, []),
    rpc: (name: string) => builder(name, []),
  } as unknown as TypedSupabaseClient;
}
