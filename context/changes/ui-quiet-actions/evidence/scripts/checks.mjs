// Manual-check helper for ui-quiet-actions: gear card heights, and the offline look (the CSS rule keyed on
// <html data-offline>, set by hand here since the visuals are pure CSS), in red and dark, at 390 px.
// Usage: BASE_URL=http://localhost:4331 node checks.mjs <worktree> <stateFile> <outDir>
import { join } from "node:path";

const [worktree, stateFile, outDir] = process.argv.slice(2);
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PREVIEW_PORT ?? 4331}`;

// Local stack only (ui-quiet-actions impl review F3): this script signs up real accounts through the server at BASE_URL,
// so it refuses anything but localhost, and the preview must run on local Supabase (never the hosted project).
function assertLocal(name, value) {
  const host = new URL(value).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") throw new Error(`${name} must point at the local stack, got ${host}`);
}
assertLocal("BASE_URL", BASE);
const browser = await chromium.launch();

for (const width of [390, 700]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, storageState: stateFile, serviceWorkers: "block" });
  const page = await context.newPage();
  await page.goto(BASE + "/tonight", { waitUntil: "networkidle" });
  const cards = await page.locator("[data-gear-select], [data-gear-name]").evaluateAll((els) =>
    els.map((el) => {
      const card = el.closest("section, div.rounded-lg, article") ?? el;
      const box = card.getBoundingClientRect();
      return Math.round(box.height);
    }),
  );
  const manage = await page.getByRole("link", { name: /Manage/ }).evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
  console.log(`width ${width}: gear card heights ${JSON.stringify(cards)}, Manage link heights ${JSON.stringify(manage)}`);
  await context.close();
}

for (const theme of ["red", "dark"]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: stateFile, serviceWorkers: "block" });
  await context.addCookies([{ name: "sidereus-theme", value: theme, url: BASE }]);
  const page = await context.newPage();
  await page.goto(BASE + "/tonight/targets", { waitUntil: "networkidle" });
  await page.evaluate(() => document.documentElement.setAttribute("data-offline", ""));
  await page.waitForTimeout(800);
  const mark = page.locator("li a[data-needs-network]").first();
  await mark.scrollIntoViewIfNeeded();
  const style = await mark.evaluate((el) => {
    const s = getComputedStyle(el);
    const svg = getComputedStyle(el.querySelector("svg"));
    return { color: s.color, border: s.borderStyle, svg: svg.color, decoration: s.textDecorationLine };
  });
  console.log(`${theme} offline Mark observed: ${JSON.stringify(style)}`);
  const box = await mark.boundingBox();
  await page.screenshot({ path: join(outDir, `offline-targets-${theme}.png`), clip: { x: 0, y: Math.max(0, box.y - 420), width: 390, height: 520 } });
  await page.goto(BASE + "/tonight", { waitUntil: "networkidle" });
  await page.evaluate(() => document.documentElement.setAttribute("data-offline", ""));
  await page.waitForTimeout(800);
  const manage = page.getByRole("link", { name: /Manage sites/ });
  const m = await manage.evaluate((el) => ({ color: getComputedStyle(el).color, decoration: getComputedStyle(el).textDecorationLine, svg: getComputedStyle(el.querySelector("svg")).color }));
  console.log(`${theme} offline Manage: ${JSON.stringify(m)}`);
  const mb = await manage.boundingBox();
  await page.screenshot({ path: join(outDir, `offline-manage-${theme}.png`), clip: { x: 0, y: Math.max(0, mb.y - 200), width: 390, height: 320 } });
  await context.close();
}
await browser.close();
