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
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
