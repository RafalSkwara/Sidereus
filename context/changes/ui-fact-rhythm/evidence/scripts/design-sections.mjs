// Screenshots single /design sections (the block after each heading id) per theme, locale and width, for the ui-fact-rhythm evidence.
// Usage: BASE_URL=http://localhost:4331 node design-sections.mjs <worktree> <outDir> [widths, comma list, default 320,1280]
// Output: <outDir>/<section>-<theme>-<locale>-<width>.png (2x below 640 px), plus per-frame and per-variant element shots.
// Prints the computed heights of the three [data-role-sample] bars and, at 320 px, the overflow table of the stat frames.
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [worktree, outDir, widthsArg] = process.argv.slice(2);
const widths = (widthsArg ?? "320,1280").split(",").map(Number);
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PREVIEW_PORT ?? 4331}`;

// Local stack only (ui-quiet-actions impl review F3): refuse anything but localhost.
function assertLocal(name, value) {
  const host = new URL(value).hostname;
  if (host !== "localhost" && host !== "127.0.0.1")
    throw new Error(`${name} must point at the local stack, got ${host}`);
}
assertLocal("BASE_URL", BASE);
const IDS = [
  "t-rhythm-roles",
  "c-stat-pair",
  "c-fact",
  "c-fact-icons",
  "c-item-rhythm",
  "c-moon-card",
  "c-night-strip",
  "c-tonight-page-skeleton",
  "c-sky-event-list",
];
const THEMES = ["dark", "light", "red"];
const LOCALES = ["en", "pl"];
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
let rolesPrinted = false;
for (const width of widths) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: width < 640 ? 2 : 1,
      });
      await context.addCookies([
        { name: "sidereus-theme", value: theme, url: BASE },
        { name: "sidereus-lang", value: locale, url: BASE },
      ]);
      const page = await context.newPage();
      await page.goto(BASE + "/design", { waitUntil: "networkidle" });
      // Fixed overlays are not part of a section: the dev toolbar and the phone TabBar would cover element shots.
      await page.addStyleTag({ content: "astro-dev-toolbar, [data-tabbar] { display: none !important; }" });
      if (!rolesPrinted) {
        rolesPrinted = true;
        for (const role of ["line", "group", "item"]) {
          const h = await page
            .locator(`[data-role-sample="${role}"]`)
            .first()
            .evaluate((el) => el.getBoundingClientRect().height);
          console.log(`role ${role}: ${h}px`);
        }
      }
      for (const id of IDS) {
        const heading = page.locator(`#${id}`);
        if ((await heading.count()) === 0) {
          console.log(`MISSING section #${id}`);
          continue;
        }
        const block = heading.locator("xpath=..");
        await block.screenshot({ path: join(outDir, `${id}-${theme}-${locale}-${width}.png`) });
        if (id === "c-item-rhythm") {
          // The owner's rhythm (2026-10-15): one column, item 20 px on each side of the rule.
          const el = page.locator("[data-rhythm-specimen]").first();
          if ((await el.count()) > 0)
            await el.screenshot({ path: join(outDir, `rhythm-${theme}-${locale}-${width}.png`) });
          else console.log("MISSING rhythm specimen");
        }
      }
      // Stat frames: locale-independent (each frame names its own language), so once per theme, at 320 only.
      if (width === 320 && locale === "en") {
        const frames = page.locator("[data-stat-frame]");
        const n = await frames.count();
        for (let i = 0; i < n; i++) {
          const f = frames.nth(i);
          const name = await f.getAttribute("data-stat-frame");
          await f.screenshot({ path: join(outDir, `stat-frame-${name}-${theme}-${width}.png`) });
          const m = await f.evaluate((el) => {
            const dl = el.querySelector("dl");
            const over = (e) => e.scrollWidth > e.clientWidth;
            return {
              dl: dl ? Math.round(dl.getBoundingClientRect().width) : null,
              dd: [...el.querySelectorAll("dd")].map(over),
              dt: [...el.querySelectorAll("dt")].map(over),
              // A wrapped value is taller than one line: count the lines of each dd.
              lines: [...el.querySelectorAll("dd")].map((e) =>
                Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)),
              ),
            };
          });
          const parts = [
            ...m.dd.map((o, k) => `dd[${k}] ${o ? "YES" : "no"}`),
            ...m.dt.map((o, k) => `dt[${k}] ${o ? "YES" : "no"}`),
          ];
          console.log(`${name} ${theme} dl=${m.dl}px overflow: ${parts.join(", ")} · dd lines: ${m.lines.join("/")}`);
        }
      }
      await context.close();
    }
  }
}
await browser.close();
