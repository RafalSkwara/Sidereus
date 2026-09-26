import { defineConfig, devices } from "@playwright/test";

// E2E runs against an already running production preview (`npm run preview`) and the forecast fixture
// (`tests/e2e/forecast-fixture.mjs`), both started by the caller as CI's smoke job does; no `webServer` here.
// It signs up real users, so point BASE_URL at a preview backed by local Supabase only, never hosted.
export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:4321",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
