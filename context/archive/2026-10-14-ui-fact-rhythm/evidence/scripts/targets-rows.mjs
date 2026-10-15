// ui-fact-rhythm: the top-five card and an opened "rest" row on /tonight/targets at 320, 390 and 1280 px.
// Usage:
//   BASE_URL=http://localhost:4331 node targets-rows.mjs <worktree> <outDir> [themes] [locales] [widths]
// Needs `state-ui-fact.json` (seeded user with the full plan) in <outDir>/.. . Writes top-/row-<theme>-<locale>-<width>.png
// The rest list's own scroll box is lifted for the shot so the whole row shows. Prints, for the opened row, its dl width, each dd's line count and overflow, and the page's sideways scroll.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const [worktree, outDir, themesArg, localesArg, widthsArg] = process.argv.slice(2);
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PREVIEW_PORT ?? 4331}`;

function assertLocal(name, value) {
  const host = new URL(value).hostname;
  if (host !== "localhost" && host !== "127.0.0.1")
    throw new Error(`${name} must point at the local stack, got ${host}`);
}
assertLocal("BASE_URL", BASE);

const THEMES = (themesArg || "dark,light,red").split(",");
const LOCALES = (localesArg || "en,pl").split(",");
const WIDTHS = (widthsArg || "320,390,1280").split(",").map(Number);
const storageState = join(dirname(outDir), "state-ui-fact.json");
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();

for (const width of WIDTHS) {
  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      const mobile = width < 1000;
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: mobile ? 2 : 1,
        isMobile: mobile,
        hasTouch: mobile,
        storageState,
        serviceWorkers: "block",
      });
      await context.addCookies([
        { name: "sidereus-theme", value: theme, url: BASE },
        { name: "sidereus-lang", value: locale, url: BASE },
      ]);
      const page = await context.newPage();
      await page.goto(BASE + "/tonight/targets", { waitUntil: "networkidle" });
      await page.locator("section ol > li[data-object]").first().waitFor({ state: "visible" });
      await page.addStyleTag({ content: "[data-tabbar]{display:none !important} details#more [role=region]{max-height:none !important;overflow:visible !important}" });
      const tag = `${theme}-${locale}-${width}`;
      const top = page.locator("ol > li[data-object]").first();
      await top.scrollIntoViewIfNeeded();
      await top.screenshot({ path: join(outDir, `top-${tag}.png`) });

      const more = page.locator("details#more");
      if (!(await more.evaluate((d) => d.open))) await more.locator("> summary").click();
      const row = page.locator("details#more ul > li[data-object]").first();
      await row.locator("summary").click();
      await row.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await row.screenshot({ path: join(outDir, `row-${tag}.png`) });

      const metrics = await row.evaluate((li) => {
        const dl = li.querySelector("dl");
        const dds = dl
          ? [...dl.querySelectorAll("dd")].map((dd) => {
              const cs = getComputedStyle(dd);
              const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
              return `${Math.round(dd.getBoundingClientRect().height / lh)}L${dd.scrollWidth > dd.clientWidth ? "!ovf" : ""}`;
            })
          : [];
        const de = document.documentElement;
        return { dl: dl ? Math.round(dl.getBoundingClientRect().width) : null, dds, side: de.scrollWidth > de.clientWidth };
      });
      console.log(tag, "dl", metrics.dl, "dd", metrics.dds.join(","), "sideways", metrics.side);
      await context.close();
    }
  }
}
await browser.close();
