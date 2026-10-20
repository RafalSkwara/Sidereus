import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { Database } from "@/lib/database.types";
import { withTimeout } from "@/lib/fetch-timeout";
import { COORDS, EMAIL, LEAK } from "@/lib/test-support/supabase-fake";
import { recordSkyVerdict } from "./record";
import { skyCheckStore } from "./store";

/**
 * The one assumption the sky-check record's trace rests on, held against the real supabase-js client: a request that
 * never completes comes back as `status` 0 with an empty `code`, and a gateway answer that is not JSON as its HTTP
 * status with no `code`. A library upgrade that changes either fails here, not in production. No network and no fake
 * timers: the guard's `AbortSignal.timeout` is real (50 ms) and unref'd, so a faked clock would hang the test.
 */

const INPUT = {
  siteId: "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
  night: "2026-10-10",
  headline: "go" as const,
  darkStart: new Date("2026-10-10T18:20:00Z"),
};

/** A fetch that never answers and gives up when its signal aborts, as the platform's does. */
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      const reason: unknown = init.signal?.reason;
      reject(reason instanceof Error ? reason : new Error("aborted"));
    });
  });

const droppedFetch: typeof fetch = () => Promise.reject(new TypeError("fetch failed"));

const gatewayFetch: typeof fetch = () =>
  Promise.resolve(
    new Response(`<html><body><h1>502 Bad Gateway</h1><p>${COORDS} ${EMAIL}</p></body></html>`, {
      status: 502,
      headers: { "content-type": "text/html" },
    }),
  );

function clientOver(fetchFn: typeof fetch) {
  return createClient<Database>("http://127.0.0.1:1", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: withTimeout(fetchFn, 50) },
  });
}

const RPC_ARGS = {
  site_id: INPUT.siteId,
  night: INPUT.night,
  headline: INPUT.headline,
  dark_start: INPUT.darkStart.toISOString(),
};

describe("a failed record against the real supabase-js client", () => {
  let errors: MockInstance<typeof console.error>;

  beforeEach(() => {
    errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errors.mockRestore();
  });

  const CASES: [string, typeof fetch, number, { code: string; status?: number }][] = [
    ["a fetch that never answers (the guard fires)", hangingFetch, 0, { code: "request" }],
    ["a fetch that is dropped", droppedFetch, 0, { code: "request" }],
    ["a gateway 502 with an HTML body", gatewayFetch, 502, { code: "http", status: 502 }],
  ];

  it.each(CASES)(
    "%s: the response says so, and the record carries and logs it",
    async (_name, fetchFn, status, expected) => {
      const response = await clientOver(fetchFn).rpc("record_sky_verdict", RPC_ARGS);
      expect(response.status).toBe(status);
      expect(response.error).not.toBeNull();
      expect(response.error?.code ?? "").toBe("");

      const result = await skyCheckStore.record(clientOver(fetchFn), INPUT);
      expect(result).toEqual({ ok: false, message: "errors.save.skyCheck", fault: { kind: "server", ...expected } });

      await recordSkyVerdict(clientOver(fetchFn), INPUT);
      expect(errors).toHaveBeenCalledTimes(1);
      expect(errors).toHaveBeenCalledWith("sidereus: tonight.sky-check-record failed", {
        step: "tonight.sky-check-record",
        ...expected,
      });
      expect(JSON.stringify([result, ...errors.mock.calls])).not.toMatch(LEAK);
    },
  );
});
