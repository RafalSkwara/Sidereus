// One-off capture for the app-icon change: screenshots the "App icon proposals" band of /design (dev only) in the
// dark, light and red themes, stacked into design-specimen.png. Needs `npx astro dev --port 4413` running.
//   node context/changes/app-icon/evidence/icon-proposals/capture-design.mjs [r2]   (r2 -> design-specimen-r2.png)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] === "r2" ? "design-specimen-r2.png" : "design-specimen.png";
const base = process.env.BASE_URL ?? "http://localhost:4413";

const browser = await chromium.launch();
const shots = [];
for (const theme of ["dark", "light", "red"]) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 4000 }, deviceScaleFactor: 1 });
  await context.addCookies([{ name: "sidereus-theme", value: theme, url: base }]);
  const page = await context.newPage();
  await page.goto(`${base}/design`, { waitUntil: "load", timeout: 120_000 });
  const band = page.locator("section", { has: page.locator("#app-icon-heading") }).first();
  await band.locator("img").first().waitFor();
  // The band sits within the tall viewport, so nothing scrolls: a live control lower down can move the scroll
  // position after load and blank an element screenshot that relies on scrolling.
  await page.addStyleTag({ content: "astro-dev-toolbar { display: none !important; }" });
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = await band.boundingBox();
  shots.push(await page.screenshot({ clip: box }));
  await context.close();
}
await browser.close();

const metas = await Promise.all(shots.map((buffer) => sharp(buffer).metadata()));
const width = Math.max(...metas.map((meta) => meta.width));
const height = metas.reduce((sum, meta) => sum + meta.height, 0);
let top = 0;
const composites = shots.map((input, index) => {
  const layer = { input, top, left: 0 };
  top += metas[index].height;
  return layer;
});
await sharp({ create: { width, height, channels: 4, background: "#070a12" } })
  .composite(composites)
  .png()
  .toFile(join(here, out));
console.log(out, width, "x", height);
