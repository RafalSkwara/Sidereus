import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Database suite: runs against a live Supabase (local `npx supabase start` or the CI smoke job) through
// PostgREST + RLS, the same path the app uses. Kept apart from vitest.config.ts so `npm test` stays DB-free.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    // One file drives a shared pair of users; network round-trips to Supabase can exceed the 5 s default.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
