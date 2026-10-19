import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMemoryLimiter } from "@/lib/observability/client-error-limit";
import { CLIENT_ERROR_PATH, CLIENT_STEPS } from "@/lib/observability/client/steps";
import { captureConsole, routeContext, type ConsoleCapture } from "@/lib/test-support/route-context";
import { ALL, POST } from "@/pages/api/client-error";

/**
 * `POST /api/client-error` (error-visibility, Phase 7): a public, untrusted endpoint. The risks these tests are the
 * only protection of: a forged or oversized request must never reach the schema or the log, an accepted report must
 * leave exactly one warn notice (never an Issue) with only a step and a name, and the route must not read the session.
 * `cloudflare:workers` is mocked with a binding backed by the in-memory limiter, so the real `rate-limit.ts` runs.
 */

const binding = vi.hoisted((): { env: Record<string, unknown> } => ({ env: {} }));
vi.mock("cloudflare:workers", async () => {
  const { cloudflareWorkers } = await import("@/lib/test-support/virtual-modules");
  return {
    get env() {
      return cloudflareWorkers(binding.env).env;
    },
  };
});

const URL_ = `http://localhost${CLIENT_ERROR_PATH}`;
const SAME_ORIGIN = { origin: "http://localhost" };
const JSON_TYPE = "application/json";

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
  binding.env = { CLIENT_ERROR_LIMITER: createMemoryLimiter({ limit: 100 }) };
});
afterEach(() => {
  logs.restore();
  binding.env = {};
});

/** A context whose `locals` fails the test on any read: the route may use the request and the URL only. */
function post(
  content: string | ReadableStream<Uint8Array>,
  options: { type?: string; headers?: Record<string, string> } = {},
) {
  const context = routeContext({
    url: URL_,
    body: { content, type: options.type ?? JSON_TYPE },
    headers: options.headers ?? SAME_ORIGIN,
  });
  context.locals = new Proxy({} as typeof context.locals, {
    get(_target, key) {
      throw new Error(`the route read locals.${String(key)}`);
    },
  });
  return POST(context);
}

const report = (value: unknown) => JSON.stringify(value);

describe("POST /api/client-error", () => {
  it("answers 204 with no body and no-store, and leaves exactly one warn notice with only the step and the name", async () => {
    const response = await post(report({ step: "sw.index", name: "QuotaExceededError" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
    expect(logs.warns).toHaveBeenCalledExactlyOnceWith("sidereus: client.sw.index noted", {
      step: "client.sw.index",
      name: "QuotaExceededError",
    });
    expect(logs.errors).not.toHaveBeenCalled();

    // A beacon sends text/plain, and a Sec-Fetch-Site header alone is enough; a report without a name has no name field.
    logs.warns.mockClear();
    const beacon = await post(report({ step: "island.import" }), {
      type: "text/plain;charset=UTF-8",
      headers: { "sec-fetch-site": "same-origin" },
    });
    expect(beacon.status).toBe(204);
    expect(logs.warns).toHaveBeenCalledExactlyOnceWith("sidereus: client.island.import noted", {
      step: "client.island.import",
    });
  });

  it("refuses a body that is not exactly a step and an optional shaped name, with 400 and no line", async () => {
    const step = CLIENT_STEPS[0];
    const bad: [string, string][] = [
      ["a code", report({ step, code: "42501" })],
      ["a source", report({ step, source: "page" })],
      ["a message", report({ step, message: "boom" })],
      ["a name with a space", report({ step, name: "has space" })],
      ["a message in the name", report({ step, name: "Failed at 52.2297,21.0122" })],
      ["a long name", report({ step, name: "A".repeat(33) })],
      ["a name that is not a string", report({ step, name: 7 })],
      ["an unknown step", report({ step: "sw.nope" })],
      ["no step", report({ name: "TypeError" })],
      ["an array", report([{ step }])],
      ["text that is not JSON", "not json"],
    ];
    expect(bad).toHaveLength(11);
    for (const [label, body] of bad) {
      expect((await post(body)).status, label).toBe(400);
    }
    expect(logs.warns).not.toHaveBeenCalled();
    expect(logs.errors).not.toHaveBeenCalled();
  });

  it("refuses 513 bytes with 413, with or without a Content-Length, and stops reading at the 513th byte", async () => {
    const padded = (size: number) => report({ step: "sw.index" }).padEnd(size, " ");
    expect((await post(padded(512))).status).toBe(204);
    logs.warns.mockClear();

    expect((await post(padded(513))).status).toBe(413);
    expect((await post(padded(10), { headers: { ...SAME_ORIGIN, "content-length": "513" } })).status).toBe(413);

    // A chunked body that never ends: the handler must stop pulling once the count passes 512.
    const chunk = new Uint8Array(100).fill(32);
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(chunk);
      },
    });
    expect((await post(endless)).status).toBe(413);
    expect(pulled).toBeGreaterThanOrEqual(6);
    expect(pulled).toBeLessThanOrEqual(8);
    expect(logs.warns).not.toHaveBeenCalled();
  });

  it("refuses a foreign origin with 403 and a body type that is not JSON or text with 415, before anything else", async () => {
    const body = report({ step: "sw.index" });
    expect((await post(body, { headers: { origin: "https://evil.example" } })).status).toBe(403);
    expect((await post(body, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect((await post(body, { headers: {} })).status).toBe(403);
    expect((await post(body, { type: "application/x-www-form-urlencoded" })).status).toBe(415);
    expect(logs.warns).not.toHaveBeenCalled();
  });

  it("answers 429 over the limit and logs nothing for the refused report", async () => {
    binding.env = { CLIENT_ERROR_LIMITER: createMemoryLimiter({ limit: 2 }) };
    const body = report({ step: "sw.index" });
    expect([(await post(body)).status, (await post(body)).status]).toEqual([204, 204]);
    logs.warns.mockClear();
    const refused = await post(body);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("cache-control")).toBe("no-store");
    expect(logs.warns).not.toHaveBeenCalled();
    expect(logs.errors).not.toHaveBeenCalled();
  });

  it("refuses every other method itself", () => {
    const response = ALL(routeContext({ url: URL_, method: "GET" }));
    expect(response).toMatchObject({ status: 405 });
  });
});
