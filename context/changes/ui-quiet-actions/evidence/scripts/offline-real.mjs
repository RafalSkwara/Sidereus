// Manual check 2.7 for real (ui-quiet-actions impl review F1): Targets and Tonight opened online with the service worker,
// then the preview is stopped (the server is genuinely unreachable, per the lesson "Make the server unreachable") and
// the pages are reloaded from the device. Asserts html[data-from-device] before reading the offline look of
// "Mark observed" (hairline) and Manage (quiet), in red and dark, at 390 px. Local stack only.
// Usage: BASE_URL=http://localhost:4331 node offline-real.mjs <worktree> <stateFile> <outDir> <stopCommand...>
//   the stop command runs once, between the online and the offline half (e.g. `npx astro preview stop`).
import { execSync } from "node:child_process";
import { join } from "node:path";

const [worktree, stateFile, outDir, ...stop] = process.argv.slice(2);
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PREVIEW_PORT ?? 4331}`;
const host = new URL(BASE).hostname;
if (host !== "localhost" && host !== "127.0.0.1") throw new Error(`BASE_URL must be local, got ${host}`);

const browser = await chromium.launch();
const contexts = {};
for (const theme of ["red", "dark"]) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    storageState: stateFile,
  });
  await context.addCookies([{ name: "sidereus-theme", value: theme, url: BASE }]);
  const page = await context.newPage();
  await page.goto(BASE + "/tonight", { waitUntil: "networkidle" });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });
  for (const path of ["/tonight", "/tonight/targets"]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.locator("[data-offline-copy]").waitFor({ state: "attached" });
  }
  // Wait until the worker's index lists both pages.
  await page.waitForFunction(
    async () => {
      const index = await (await caches.open("sidereus-tonight-v1")).match("/__offline/index.json");
      if (!index) return false;
      const { copies } = await index.json();
      const pages = copies.map((copy) => copy.page);
      return pages.includes("/tonight") && pages.includes("/tonight/targets");
    },
    null,
    { timeout: 30000, polling: 500 },
  );
  contexts[theme] = { context, page };
}

execSync(stop.join(" "), { stdio: "inherit" });

for (const [theme, { context, page }] of Object.entries(contexts)) {
  await context.setOffline(true);
  await page.goto(BASE + "/tonight/targets");
  await page.locator("html[data-from-device]").waitFor({ state: "attached", timeout: 15000 });
  await page.locator("html[data-offline]").waitFor({ state: "attached", timeout: 15000 });
  await page.waitForTimeout(800);
  const mark = page.locator("li a[data-needs-network]").first();
  await mark.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const markStyle = await mark.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      ariaDisabled: el.getAttribute("aria-disabled"),
      color: s.color,
      icon: getComputedStyle(el.querySelector("svg")).color,
      border: s.borderTopStyle,
      underline: s.textDecorationLine,
    };
  });
  console.log(`${theme} stored /tonight/targets, Mark observed: ${JSON.stringify(markStyle)}`);
  const box = await mark.boundingBox();
  await page.screenshot({
    path: join(outDir, `offline-real-mark-observed-${theme}.png`),
    clip: { x: 0, y: Math.max(0, box.y - 320), width: 390, height: 420 },
  });

  await page.goto(BASE + "/tonight");
  await page.locator("html[data-from-device]").waitFor({ state: "attached", timeout: 15000 });
  await page.waitForTimeout(800);
  const manage = page.getByRole("link", { name: "Manage sites" });
  // The live sky keeps animating, so Playwright never sees the link "stable": scroll it into view by hand.
  await manage.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const manageStyle = await manage.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      ariaDisabled: el.getAttribute("aria-disabled"),
      color: s.color,
      icon: getComputedStyle(el.querySelector("svg")).color,
      underline: s.textDecorationLine,
    };
  });
  console.log(`${theme} stored /tonight, Manage: ${JSON.stringify(manageStyle)}`);
  const mb = await manage.boundingBox();
  await page.screenshot({
    path: join(outDir, `offline-real-manage-${theme}.png`),
    clip: { x: 0, y: Math.max(0, mb.y - 220), width: 390, height: 320 },
    animations: "disabled",
  });
  await context.close();
}
await browser.close();
