import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests cover pure TypeScript under src/lib and do not need the Astro pipeline.
// Astro's `getViteConfig` was tried first, but it loads the Cloudflare adapter's Vite plugin,
// which tries to run the test runner inside workerd and fails with "module is not defined";
// the adapter cannot be removed through `getViteConfig`'s inline-config argument. This plain
// config reproduces what the tests actually need from the app config: the `@/*` alias and
// TypeScript resolution. astro.config.mjs is untouched.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // scripts/**/*.test.mjs: the pure helpers of the generator scripts (scripts/lib/), tested like src/ code.
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
    environment: "node",
    // The runner-zone suites switch process.env.TZ in-process, which a worker_threads worker ignores: they need
    // forks (src/lib/engine/fixtures/runner-zones.ts). Forks is Vitest's default; pinned so it stays a fact.
    pool: "forks",
  },
});
