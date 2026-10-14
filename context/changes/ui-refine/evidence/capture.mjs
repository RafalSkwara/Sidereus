// Captures the ui-refine audit matrix: routes × locale (en, pl) × theme (dark, light, red) × viewport (390 phone, 1280 desktop).
// Usage: node capture.mjs <worktree> <stateFile> <outDir> [filter-regex] [themes] [locales] [viewports]
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [worktree, stateFile, outDir, filter, themesArg, localesArg, viewportsArg] = process.argv.slice(2);
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

const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
};
const THEMES = (themesArg || "dark,light,red").split(",");
const LOCALES = (localesArg || "en,pl").split(",");
const VIEWS = (viewportsArg || "phone,desktop").split(",");

let ROUTES = [
  ["tonight", "/tonight"],
  ["targets", "/tonight/targets"],
  ["plan", "/tonight/plan"],
  ["moon", "/tonight/moon"],
  ["planets", "/tonight/planets"],
  ["nights", "/tonight/nights"],
  ["finder", "FINDER"],
  ["log", "/log"],
  ["progress", "/log/progress"],
  ["gear", "/gear"],
];
if (filter) ROUTES = ROUTES.filter(([name]) => new RegExp(filter).test(name));

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
let finderPath = null;

for (const view of VIEWS) {
  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        ...VIEWPORTS[view],
        storageState: stateFile,
        serviceWorkers: "block",
      });
      await context.addCookies([
        { name: "sidereus-theme", value: theme, url: BASE },
        { name: "sidereus-lang", value: locale, url: BASE },
      ]);
      const page = await context.newPage();
      for (const [name, route] of ROUTES) {
        let path = route;
        if (route === "FINDER") {
          if (!finderPath) {
            await page.goto(BASE + "/tonight/targets", { waitUntil: "networkidle" });
            finderPath = await page.locator('a[href*="/tonight/finder?object="]').first().getAttribute("href");
          }
          path = finderPath;
        }
        await page.goto(BASE + path, { waitUntil: "networkidle" });
        await page.waitForTimeout(600);
        const file = join(outDir, `${name}-${view}-${locale}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: true });
        if (name === "tonight" || name === "targets") {
          await page.screenshot({ path: join(outDir, `${name}-${view}-${locale}-${theme}-fold.png`) });
        }
        console.log(file);
      }
      await context.close();
    }
  }
}
await browser.close();
