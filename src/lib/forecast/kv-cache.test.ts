import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

/**
 * `kvForecastCache` is the one module that imports `cloudflare:workers`, which Vitest cannot resolve, so the binding
 * object is supplied through the shared seam; each case sets what the mock's `env` holds before the module loads.
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

import { kvForecastCache } from "./kv-cache";

describe("kvForecastCache", () => {
  let errors: MockInstance<typeof console.error>;

  beforeEach(() => {
    errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errors.mockRestore();
    binding.env = {};
  });

  it("logs forecast.cache-missing once, with the step only, and falls back to a cache that stores nothing", async () => {
    binding.env = {};
    const cache = kvForecastCache();
    await expect(cache.get("forecast:v1:site:abc")).resolves.toBeNull();
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("sidereus: forecast.cache-missing failed", { step: "forecast.cache-missing" });
  });

  it("logs nothing when the FORECAST_CACHE binding is present, and reads and writes through it", async () => {
    const kv = {
      get: vi.fn<(key: string) => Promise<string | null>>().mockResolvedValue("stored"),
      put: vi
        .fn<(key: string, value: string, options: { expirationTtl: number }) => Promise<void>>()
        .mockResolvedValue(),
    };
    binding.env = { FORECAST_CACHE: kv };
    const cache = kvForecastCache();
    await expect(cache.get("k")).resolves.toBe("stored");
    await cache.put("k", "v", { expirationTtl: 60 });
    expect(kv.put).toHaveBeenCalledWith("k", "v", { expirationTtl: 60 });
    expect(errors).not.toHaveBeenCalled();
  });
});
