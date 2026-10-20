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
  /**
   * The response's HTTP status, as supabase-js puts it next to `error`: 0 when no response came back (a timeout, a
   * dropped connection), the HTTP status otherwise. Absent unless the test gives one: there is no default, so a test
   * that never mentions it reads the same as before.
   */
  status?: number;
}

/** Text a real database error echoes: the submitted coordinates and an email. */
export const COORDS = "52.2297,21.0122";
export const EMAIL = "ada.lovelace@example.test";
/** Matches any trace of `COORDS` or `EMAIL`. */
export const LEAK = /52\.2297|21\.0122|ada\.lovelace|example\.test/;

/**
 * A PostgREST-shaped error whose message, details and hint all hold the submitted values, as a failing insert's do.
 * It has no `status`, as the real `PostgrestError` has none: the HTTP status lives on the response, which the stores
 * do not thread through (impl review F6), so a store fault in these tests carries a `code` only.
 */
export function leakyPostgrestError(code: string) {
  return {
    name: "PostgrestError",
    message: `new row violates a constraint: Failing row contains (${COORDS}, ${EMAIL})`,
    details: `Key (latitude_deg)=(${COORDS}) belongs to ${EMAIL}`,
    hint: EMAIL,
    code,
  };
}

/**
 * What supabase-js hands back when the request never completed (a fetch timeout or a dropped connection): a message
 * that names the fetch error and, here, echoes the submitted values as a real message can, an empty `code`, and
 * nothing else. Pair it with `status: 0`.
 */
export function transportError() {
  return {
    message: `TimeoutError: The operation was aborted due to timeout while sending (${COORDS}, ${EMAIL})`,
    details: `TimeoutError: aborted\n    at fetch (${EMAIL})`,
    hint: "",
    code: "",
  };
}

/**
 * What supabase-js hands back when a gateway answers a non-2xx status with a body that is not JSON (a 502 with an HTML
 * page): the body as the message and no `code`. Pair it with `status: 502`.
 */
export function gatewayError() {
  return { message: `<html><body><h1>502 Bad Gateway</h1><p>${COORDS} ${EMAIL}</p></body></html>` };
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
  const answer = (
    target: string,
    calls: readonly string[],
  ): Promise<Required<Omit<FakeResult, "status">> & Pick<FakeResult, "status">> => {
    const result = typeof resolve === "function" ? resolve(target, calls) : resolve;
    return Promise.resolve({
      data: result.data ?? null,
      error: result.error ?? null,
      count: result.count ?? null,
      ...(result.status === undefined ? {} : { status: result.status }),
    });
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
