import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// The static guards (ESLint, the whole source tree, the hook scripts) cost far more than the rest of the suite together.
const GUARD_FILES = [
  "src/lib/no-console-guard.test.ts",
  "src/lib/agent-hooks.test.ts",
  "src/lib/runner-zone-guard.test.ts",
  "src/styles/no-hardcoded-colors.test.ts",
  "src/styles/rhythm-roles.test.ts",
];

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
    environment: "node",
    // The runner-zone suites switch process.env.TZ in-process, which a worker_threads worker ignores: they need
    // forks (src/lib/engine/fixtures/runner-zones.ts). Forks is Vitest's default; pinned so it stays a fact.
    pool: "forks",
    // Two projects (test-suite-diet D1, D2): `reference` is the fast suite the end-of-turn hook runs; `guards` are the
    // slow static guards and the hook's own proof, which run in CI only (`npm test` runs both).
    projects: [
      {
        extends: true,
        test: {
          name: "reference",
          // scripts/**/*.test.mjs: the pure helpers of the generator scripts (scripts/lib/), tested like src/ code.
          include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
          exclude: [...configDefaults.exclude, ...GUARD_FILES],
        },
      },
      {
        extends: true,
        test: { name: "guards", include: GUARD_FILES },
      },
    ],
  },
});
