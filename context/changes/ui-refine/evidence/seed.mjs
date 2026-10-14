// Seeds one local test user for the ui-refine audit: onboarding in Madrid, a few log entries, storage state saved.
// Usage: node seed.mjs <worktree> <outDir>
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const [worktree, outDir] = process.argv.slice(2);
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = "http://localhost:4331";
const PASSWORD = "E2e-Test-Passw0rd!";
const email = `ui-refine-${randomUUID()}@example.com`;

const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.route("https://geocoding-api.open-meteo.com/**", (route) =>
  route.fulfill({
    json: { results: [{ id: 3117735, name: "Madrid", latitude: 40.4168, longitude: -3.7038, admin1: "Madrid", country: "Spain" }] },
    headers: { "Access-Control-Allow-Origin": "*" },
  }),
);

async function hydrated(selector) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return el && !document.querySelector("astro-island[ssr]") && Object.keys(el).some((k) => k.startsWith("__reactProps$"));
    },
    selector,
    { timeout: 20000 },
  );
}

await page.goto("/auth/signup");
await hydrated('form[action="/api/auth/signup"]');
await page.fill("#email", email);
await page.fill("#password", PASSWORD);
await page.fill("#confirmPassword", PASSWORD);
await page.click('form[action="/api/auth/signup"] button[type="submit"]');
await page.waitForURL(/\/onboarding$/);
await hydrated('form[action="/api/onboarding"]');
await page.fill("#place-search", "Madrid");
await page.getByRole("button", { name: "Madrid, Madrid, Spain" }).click();
await page.click('form[action="/api/onboarding"] button[type="submit"]');
await page.waitForURL(/\/tonight$/);

for (const object of ["M31", "M13", "M57", "moon", "jupiter", "NGC7000"]) {
  try {
    await page.goto(`/log/new?object=${object}&from=log`);
    await hydrated('form[action="/api/log"]');
    const form = page.locator('form[action="/api/log"]');
    await form.locator("label").filter({ hasText: /^4$/ }).click();
    await form.locator('button[type="submit"]').click();
    await page.waitForURL(/\/log(\?|$)/, { timeout: 15000 });
    const dialog = page.locator("dialog[data-milestone-celebration][open]");
    if (await dialog.count()) await dialog.locator("[data-milestone-close]").click();
    console.log("logged", object);
  } catch (error) {
    console.log("log failed", object, String(error).split("\n")[0]);
  }
}

await context.storageState({ path: join(outDir, "state.json") });
writeFileSync(join(outDir, "email.txt"), email);
console.log(email);
await browser.close();
