// ui-fact-rhythm: how far the skeleton's height is from the real page's, on the five focused pages (390 and 1280 px).
// Usage:
//   BASE_URL=http://localhost:4331 node skeleton-heights.mjs <worktree> <outDir>
// Needs `state-ui-fact.json` (seeded user with the full plan) in <outDir>/.. . Writes skeleton-<page>-<width>.png (the
// fallback kept by aborting every /_server-islands/ request) and prints one line per page and width:
//   <page> <width> skeleton=<h> real=<h> delta=<real-skeleton>
// The real page is a fresh context without the abort, measured once the skeleton's slow hint is gone.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const [worktree, outDir] = process.argv.slice(2);
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PREVIEW_PORT ?? 4331}`;

function assertLocal(name, value) {
  const host = new URL(value).hostname;
  if (host !== "localhost" && host !== "127.0.0.1")
    throw new Error(`${name} must point at the local stack, got ${host}`);
}
assertLocal("BASE_URL", BASE);

const storageState = join(dirname(outDir), "state-ui-fact.json");
const PAGES = ["targets", "planets", "moon", "nights", "events", "finder?object=M13&from=targets"];
const VIEWS = {
  390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  1280: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
};
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();

async function open(width, abort) {
  const context = await browser.newContext({ ...VIEWS[width], storageState, serviceWorkers: "block" });
  await context.addCookies([
    { name: "sidereus-theme", value: "dark", url: BASE },
    { name: "sidereus-lang", value: "en", url: BASE },
  ]);
  if (abort) await context.route((url) => url.pathname.includes("/_server-islands/"), (route) => route.abort());
  return context;
}
const height = (page) => page.evaluate(() => document.documentElement.scrollHeight);

for (const name of PAGES) {
  for (const width of Object.keys(VIEWS)) {
    const path = `/tonight/${name}`;
    const a = await open(width, true);
    const pa = await a.newPage();
    await pa.goto(BASE + path, { waitUntil: "load" });
    await pa.waitForTimeout(800);
    await pa.addStyleTag({ content: "[data-tabbar] { display: none !important; }" });
    if ((await pa.locator(".slow-hint").count()) === 0) throw new Error(`${name} ${width}: no skeleton shown`);
    const skeleton = await height(pa);
    await pa.screenshot({ path: join(outDir, `skeleton-${name.split("?")[0]}-${width}.png`), fullPage: true });
    await a.close();

    const b = await open(width, false);
    const pb = await b.newPage();
    await pb.goto(BASE + path, { waitUntil: "networkidle" });
    await pb.locator(".slow-hint").waitFor({ state: "detached", timeout: 15000 });
    await pb.waitForTimeout(600);
    const real = await height(pb);
    await b.close();
    console.log(`${name} ${width} skeleton=${skeleton} real=${real} delta=${real - skeleton}`);
  }
}
await browser.close();
