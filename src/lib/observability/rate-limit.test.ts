import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { captureConsole, type ConsoleCapture } from "@/lib/test-support/route-context";

import { CLIENT_ERROR_LIMIT, CLIENT_ERROR_LIMIT_KEY } from "./client-error-limit";

/**
 * `allowClientError` reads the `CLIENT_ERROR_LIMITER` binding from `cloudflare:workers`, which Vitest cannot resolve,
 * so the binding object comes through the shared seam. "Once per isolate" is the module's own state, so each case
 * loads a fresh copy (a new copy is a new isolate).
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

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
  vi.resetModules();
});
afterEach(() => {
  logs.restore();
  binding.env = {};
});

describe("allowClientError", () => {
  it("without the binding serves from the in-memory bucket, never allow-all, and says so once per isolate", async () => {
    const { allowClientError } = await import("./rate-limit");
    const results: boolean[] = [];
    for (let i = 0; i < CLIENT_ERROR_LIMIT + 2; i++) {
      results.push(await allowClientError());
    }
    expect(results.filter(Boolean)).toHaveLength(CLIENT_ERROR_LIMIT);
    expect(results.at(-1)).toBe(false);
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: config.rate-limit failed", {
      step: "config.rate-limit",
    });
    expect(logs.warns).not.toHaveBeenCalled();
  });

  it("fails closed when the binding itself errors, and says so once per isolate", async () => {
    const limit = vi
      .fn<(options: { key: string }) => Promise<{ success: boolean }>>()
      .mockRejectedValue(new Error("down"));
    binding.env = { CLIENT_ERROR_LIMITER: { limit } };
    const { allowClientError } = await import("./rate-limit");
    expect(await allowClientError()).toBe(false);
    expect(await allowClientError()).toBe(false);
    expect(limit).toHaveBeenCalledTimes(2);
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: config.rate-limit failed", {
      step: "config.rate-limit",
      name: "Error",
    });
  });

  it("with the binding calls it under the one constant key, answers what it answers and logs nothing", async () => {
    const limit = vi.fn<(options: { key: string }) => Promise<{ success: boolean }>>();
    limit.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
    binding.env = { CLIENT_ERROR_LIMITER: { limit } };
    const { allowClientError } = await import("./rate-limit");
    expect(await allowClientError()).toBe(true);
    expect(await allowClientError()).toBe(false);
    expect(limit.mock.calls).toEqual([[{ key: CLIENT_ERROR_LIMIT_KEY }], [{ key: CLIENT_ERROR_LIMIT_KEY }]]);
    expect(logs.errors).not.toHaveBeenCalled();
  });
});
