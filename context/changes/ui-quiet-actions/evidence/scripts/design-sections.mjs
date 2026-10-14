// Screenshots single /design sections (the block after each heading id) per theme, for the ui-quiet-actions evidence.
// Usage: BASE_URL=http://localhost:4331 node design-sections.mjs <worktree> <outDir> <tag>
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [worktree, outDir, tag] = process.argv.slice(2);
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = process.env.BASE_URL ?? "http://localhost:4331";
const IDS = ["c-button", "c-link-button", "c-back-link", "c-pager", "c-gear-row", "c-tile", "c-events-tile"];
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
for (const theme of ["dark", "light", "red"]) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies([{ name: "sidereus-theme", value: theme, url: BASE }]);
  const page = await context.newPage();
  await page.goto(BASE + "/design", { waitUntil: "networkidle" });
  for (const id of IDS) {
    const heading = page.locator(`#${id}`);
    if ((await heading.count()) === 0) continue;
    // The section is the heading's parent block.
    const block = heading.locator("xpath=..");
    await block.screenshot({ path: join(outDir, `design-${id}-${theme}-${tag}.png`) });
  }
  await context.close();
}
await browser.close();
