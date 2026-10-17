import type { AstroCookies } from "astro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { captureConsole, type ConsoleCapture } from "@/lib/test-support/route-context";

/**
 * `createClient` without configuration (error-visibility, Phase 5): a built app that boots with no Supabase variables
 * signs every user out, so the first `null` of an isolate leaves one `config.supabase` line; a dev server stays
 * quiet. "Once per isolate" is the module's own state, so each case loads a fresh copy of the module.
 */

vi.mock("astro:env/server", async () =>
  (await import("@/lib/test-support/virtual-modules")).astroEnvServer({ SUPABASE_URL: undefined, SUPABASE_KEY: "k" }),
);

const COOKIES = { set: () => undefined } as unknown as AstroCookies;

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
  vi.resetModules();
});
afterEach(() => {
  logs.restore();
  vi.unstubAllEnvs();
});

async function freshCreateClient() {
  return (await import("@/lib/supabase")).createClient;
}

describe("createClient with no Supabase configuration", () => {
  it("returns null and logs config.supabase once per isolate in a built app", async () => {
    vi.stubEnv("DEV", false);
    const createClient = await freshCreateClient();
    expect(createClient(new Headers(), COOKIES)).toBeNull();
    expect(createClient(new Headers(), COOKIES)).toBeNull();
    expect(createClient(new Headers(), COOKIES)).toBeNull();
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: config.supabase failed", {
      step: "config.supabase",
    });
    expect(logs.warns).not.toHaveBeenCalled();
  });
});
