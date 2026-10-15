// ui-tonight-nav: crops of the bars and the Tonight sub-nav, per locale and theme. Local stack only.
// Usage: BASE_URL=http://localhost:4331 node nav-shots.mjs <worktree> <stateFile> <outDir> <bars|subnav>
//   bars:   the TabBar at 320 / 390 px and the Topbar at 768 / 1024 / 1280 px on /log/progress.
//   subnav: the top of /tonight/{targets,plan,events} at 390 and 1280 px (Topbar, sub-nav, page sky).
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [worktree, storageState, outDir, mode = "bars"] = process.argv.slice(2);
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = process.env.BASE_URL ?? "http://localhost:4331";
const host = new URL(BASE).hostname;
if (host !== "localhost" && host !== "127.0.0.1") throw new Error(`BASE_URL must be local, got ${host}`);

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();

async function shot(locale, theme, width, path, name, clip) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    storageState,
    serviceWorkers: "block",
  });
  await context.addCookies([
    { name: "sidereus-theme", value: theme, url: BASE },
    { name: "sidereus-lang", value: locale, url: BASE },
  ]);
  const page = await context.newPage();
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  if (path.startsWith("/tonight/")) await page.locator("[data-offline-copy]").first().waitFor({ state: "attached" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, `${name}-${width}-${locale}-${theme}.jpg`), type: "jpeg", quality: 80, clip: clip(width) });
  await context.close();
}

for (const locale of ["en", "pl"]) {
  for (const theme of ["dark", "light", "red"]) {
    if (mode === "bars") {
      for (const width of [320, 390]) await shot(locale, theme, width, "/log/progress", "nav-tabbar", (w) => ({ x: 0, y: 844 - 72, width: w, height: 72 }));
      for (const width of [768, 1024, 1280]) await shot(locale, theme, width, "/log/progress", "nav-topbar", (w) => ({ x: 0, y: 0, width: w, height: 96 }));
    } else {
      for (const page of ["targets", "plan", "events"])
        for (const width of [390, 1280])
          await shot(locale, theme, width, `/tonight/${page}`, `subnav-${page}`, (w) => ({ x: 0, y: 0, width: w, height: 340 }));
    }
  }
}
await browser.close();
