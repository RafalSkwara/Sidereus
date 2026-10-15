// ui-dashboard-tiles: screenshots one /design section (dev server only, /design is dev only). Usage:
//   BASE_URL=http://localhost:4331 node design-section.mjs <worktree> <outDir> <section-heading-id> [themes] [locales] [widths]
// Writes <id>-<width>-<locale>-<theme>.png of the <section aria-labelledby=id>. No sign-in: /design needs none. Local only.
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [worktree, outDir, id, themesArg, localesArg, widthsArg] = process.argv.slice(2);
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = process.env.BASE_URL ?? "http://localhost:4331";
const host = new URL(BASE).hostname;
if (host !== "localhost" && host !== "127.0.0.1") throw new Error(`BASE_URL must be local, got ${host}`);

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
for (const width of (widthsArg || "390,1280").split(",").map(Number)) {
  for (const locale of (localesArg || "en,pl").split(",")) {
    for (const theme of (themesArg || "dark,light,red").split(",")) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: width < 640 ? 2 : 1,
        serviceWorkers: "block",
      });
      await context.addCookies([
        { name: "sidereus-theme", value: theme, url: BASE },
        { name: "sidereus-lang", value: locale, url: BASE },
      ]);
      const page = await context.newPage();
      await page.goto(`${BASE}/design`, { waitUntil: "networkidle", timeout: 120000 });
      await page.evaluate(() => document.fonts.ready);
      const section = page.locator(`section[aria-labelledby="${id}"]`);
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await section.screenshot({ path: join(outDir, `${id}-${width}-${locale}-${theme}.png`) });
      console.log("captured", id, width, locale, theme);
      await context.close();
    }
  }
}
await browser.close();
