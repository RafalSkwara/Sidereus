import { describe, expect, it, vi } from "vitest";

vi.mock("astro:middleware", async () => (await import("@/lib/test-support/virtual-modules")).astroMiddleware());
vi.mock("astro:env/server", async () =>
  (await import("@/lib/test-support/virtual-modules")).astroEnvServer({
    SUPABASE_URL: undefined,
    SUPABASE_KEY: undefined,
  }),
);
vi.mock("cloudflare:workers", async () => (await import("@/lib/test-support/virtual-modules")).cloudflareWorkers({}));

describe("virtual-module seams", () => {
  it("loads src/middleware.ts under the mocks", async () => {
    const mod = await import("@/middleware");
    expect(typeof mod.onRequest).toBe("function");
  });

  it("loads src/lib/supabase.ts under the mocks", async () => {
    const mod = await import("@/lib/supabase");
    expect(typeof mod.createClient).toBe("function");
  });

  it("loads src/lib/forecast/kv-cache.ts under the mocks", async () => {
    const mod = await import("@/lib/forecast/kv-cache");
    expect(typeof mod.kvForecastCache).toBe("function");
  });
});
