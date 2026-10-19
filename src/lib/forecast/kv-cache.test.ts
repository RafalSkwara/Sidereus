import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

/**
 * `kvForecastCache` is one of two modules that import `cloudflare:workers`, which Vitest cannot resolve, so the binding
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

/**
 * "Once per isolate" is the module's own state (like `config.supabase` in `src/lib/supabase.ts`), so each case loads a
 * fresh copy of the module: a new copy is a new isolate.
 */
async function freshKvForecastCache() {
  return (await import("./kv-cache")).kvForecastCache;
}

describe("kvForecastCache", () => {
  let errors: MockInstance<typeof console.error>;

  beforeEach(() => {
    errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.resetModules();
  });

  afterEach(() => {
    errors.mockRestore();
    binding.env = {};
  });

  it("logs forecast.cache-missing once per isolate, with the step only, and every call gets a cache that stores nothing", async () => {
    binding.env = {};
    const kvForecastCache = await freshKvForecastCache();
    const caches = [kvForecastCache(), kvForecastCache(), kvForecastCache()];
    for (const cache of caches) {
      await expect(cache.get("forecast:v1:site:abc")).resolves.toBeNull();
    }
    expect(errors).toHaveBeenCalledExactlyOnceWith("sidereus: forecast.cache-missing failed", {
      step: "forecast.cache-missing",
    });
  });

  it("logs nothing when the FORECAST_CACHE binding is present, and reads through it", async () => {
    const kv = { get: () => Promise.resolve("stored"), put: () => Promise.resolve() };
    binding.env = { FORECAST_CACHE: kv };
    const kvForecastCache = await freshKvForecastCache();
    await expect(kvForecastCache().get("k")).resolves.toBe("stored");
    expect(errors).not.toHaveBeenCalled();
  });
});
