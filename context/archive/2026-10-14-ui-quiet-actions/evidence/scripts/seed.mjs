// Seeds one local test user for the ui-refine audit: onboarding in Madrid, a few log entries, storage state saved.
// Usage: BASE_URL=http://localhost:4331 SUPABASE_URL=http://127.0.0.1:54321 node seed.mjs <worktree> <outDir> [prefix] [--empty-eyepieces]
// --empty-eyepieces deletes the user's eyepieces through the API as that user (RLS), so /gear shows an empty band.
// It reads SUPABASE_URL / SUPABASE_KEY (the publishable key) from the environment.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const [worktree, outDir, prefix = "ui-refine", flag] = process.argv.slice(2);
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PREVIEW_PORT ?? 4331}`;

// Local stack only (ui-quiet-actions impl review F3): this script signs up real accounts through the server at BASE_URL,
// so it refuses anything but localhost, and the preview must run on local Supabase (never the hosted project).
function assertLocal(name, value) {
  const host = new URL(value).hostname;
  if (host !== "localhost" && host !== "127.0.0.1")
    throw new Error(`${name} must point at the local stack, got ${host}`);
}
assertLocal("BASE_URL", BASE);
if (!process.env.SUPABASE_URL)
  throw new Error("set SUPABASE_URL to the local stack (API_URL from `npx supabase status -o env`)");
assertLocal("SUPABASE_URL", process.env.SUPABASE_URL);
const PASSWORD = "E2e-Test-Passw0rd!";
const email = `${prefix}-${randomUUID()}@example.com`;

const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.route("https://geocoding-api.open-meteo.com/**", (route) =>
  route.fulfill({
    json: {
      results: [
        { id: 3117735, name: "Madrid", latitude: 40.4168, longitude: -3.7038, admin1: "Madrid", country: "Spain" },
      ],
    },
    headers: { "Access-Control-Allow-Origin": "*" },
  }),
);

async function hydrated(selector) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return (
        el && !document.querySelector("astro-island[ssr]") && Object.keys(el).some((k) => k.startsWith("__reactProps$"))
      );
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

if (flag === "--empty-eyepieces") {
  const { createClient } = await import(join(worktree, "node_modules/@supabase/supabase-js/dist/index.mjs"));
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw new Error(`sign-in failed: ${signIn.error.message}`);
  const { error } = await client.from("eyepieces").delete().not("id", "is", null);
  if (error) throw new Error(`eyepiece delete failed: ${error.message}`);
  console.log("eyepieces deleted");
}

await context.storageState({ path: join(outDir, `state-${prefix}.json`) });
writeFileSync(join(outDir, `email-${prefix}.txt`), email);
console.log(email);
await browser.close();
