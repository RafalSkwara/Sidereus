// ui-fact-rhythm: element screenshots of one target row, one planet card and one event row (the "after" crops) at 390 px 2x, en.
// Usage:
//   BASE_URL=http://localhost:4331 node crops.mjs <worktree> <outDir> [themes]
// Needs `state-ui-fact.json` in <outDir>/.. . Writes target-/planet-/event-<theme>.png.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const [worktree, outDir, themesArg] = process.argv.slice(2);
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PREVIEW_PORT ?? 4331}`;

function assertLocal(name, value) {
  const host = new URL(value).hostname;
  if (host !== "localhost" && host !== "127.0.0.1")
    throw new Error(`${name} must point at the local stack, got ${host}`);
}
assertLocal("BASE_URL", BASE);

const THEMES = (themesArg || "light,red").split(",");
const SHOTS = [
  ["target", "/tonight/targets", "ol > li[data-object]"],
  ["planet", "/tonight/planets", 'li[id^="planet-"]'],
  ["event", "/tonight/events", "li[data-event-kind]"],
];
const storageState = join(dirname(outDir), "state-ui-fact.json");
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
for (const theme of THEMES) {
  for (const [name, path, selector] of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 900 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      storageState,
      serviceWorkers: "block",
    });
    await context.addCookies([
      { name: "sidereus-theme", value: theme, url: BASE },
      { name: "sidereus-lang", value: "en", url: BASE },
    ]);
    const page = await context.newPage();
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    const el = page.locator(selector).first();
    await el.waitFor({ state: "visible" });
    await page.addStyleTag({ content: "[data-tabbar]{display:none !important}" });
    await el.scrollIntoViewIfNeeded();
    await el.screenshot({ path: join(outDir, `${name}-${theme}.png`) });
    console.log(name, theme);
    await context.close();
  }
}
await browser.close();
