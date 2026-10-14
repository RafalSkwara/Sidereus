// Screenshots single /design sections (the block after each heading id) per theme, for the ui-quiet-actions evidence.
// Usage: BASE_URL=http://localhost:4331 node design-sections.mjs <worktree> <outDir> <tag> [width, default 1280]
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [worktree, outDir, tag, widthArg] = process.argv.slice(2);
const width = Number(widthArg ?? 1280);
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PREVIEW_PORT ?? 4331}`;

// Local stack only (ui-quiet-actions impl review F3): this script signs up real accounts through the server at BASE_URL,
// so it refuses anything but localhost, and the preview must run on local Supabase (never the hosted project).
function assertLocal(name, value) {
  const host = new URL(value).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") throw new Error(`${name} must point at the local stack, got ${host}`);
}
assertLocal("BASE_URL", BASE);
const IDS = [
  "c-button",
  "c-link-button",
  "c-back-link",
  "c-pager",
  "c-gear-row",
  "c-tile",
  "c-events-tile",
  "c-verdict-event",
  "c-milestone-celebration",
];
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
for (const theme of ["dark", "light", "red"]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: width < 640 ? 2 : 1 });
  await context.addCookies([{ name: "sidereus-theme", value: theme, url: BASE }]);
  const page = await context.newPage();
  await page.goto(BASE + "/design", { waitUntil: "networkidle" });
  for (const id of IDS) {
    const heading = page.locator(`#${id}`);
    if ((await heading.count()) === 0) continue;
    // The section is the heading's parent block.
    const block = heading.locator("xpath=..");
    await block.screenshot({ path: join(outDir, `design-${id}-${theme}-${width}-${tag}.png`) });
  }
  await context.close();
}
await browser.close();
