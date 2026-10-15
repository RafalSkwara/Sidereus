// ui-dashboard-tiles: captures and measures the /tonight dashboard. Usage:
//   BASE_URL=http://localhost:4331 node dashboard.mjs <worktree> <outDir> [themes] [locales] [viewports] [--measure]
// Needs `state-<prefix>.json` from seed.mjs in <outDir>/.. (STATE_PREFIX, default "ui-dash"). Viewports: narrow (320 px,
// 2x), w360 (360 px, 2x), phone (390 px, 2x), w640 (640 px, 2x), desktop (1280 px); w360 and w640 are the widths
// `VERDICT_MIN_HEIGHT_CLASS` is measured at. Per combination it writes the full page (TabBar hidden, it is fixed), the
// first screen with the TabBar (`-fold`) and the tiles block alone (`-tiles`). With --measure it also prints, per
// combination, the boxes the phone-first spec pins (headline bottom, Site card bottom, Telescope title bottom, first tile
// top, TabBar top), the verdict section's and each tile's height, and the skeleton's height against the real page
// (skeleton: every /_server-islands/ request aborted), plus the verdict container's natural height (the element carrying
// `VERDICT_MIN_HEIGHT_CLASS`, read from the worktree's sky-band.ts, so build after changing it) with `min-height: 0`
// injected, and as rendered, on the real page with the event line and its wrapper hidden (`eventLine` says whether
// there was one) and on the skeleton. Local stack only.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const measure = args.includes("--measure");
const [worktree, outDir, themesArg, localesArg, viewportsArg] = args.filter((a) => a !== "--measure");
const { chromium } = await import(join(worktree, "node_modules/playwright/index.mjs"));
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PREVIEW_PORT ?? 4331}`;

function assertLocal(name, value) {
  const host = new URL(value).hostname;
  if (host !== "localhost" && host !== "127.0.0.1")
    throw new Error(`${name} must point at the local stack, got ${host}`);
}
assertLocal("BASE_URL", BASE);

const storageState = join(dirname(outDir), `state-${process.env.STATE_PREFIX ?? "ui-dash"}.json`);
const VIEWPORTS = {
  narrow: { viewport: { width: 320, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w360: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w640: { viewport: { width: 640, height: 900 }, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
};
const THEMES = (themesArg || "dark,light,red").split(",");
const LOCALES = (localesArg || "en,pl").split(",");
const VIEWS = (viewportsArg || "phone,desktop").split(",");

// The verdict container's classes, as the source names them: `VERDICT_MIN_HEIGHT_CLASS` in sky-band.ts.
const MIN_HEIGHT_CLASSES = /VERDICT_MIN_HEIGHT_CLASS\s*=\s*"([^"]+)"/
  .exec(readFileSync(join(worktree, "src/components/tonight/sky-band.ts"), "utf8"))[1]
  .split(/\s+/);

/**
 * The element carrying every `VERDICT_MIN_HEIGHT_CLASS` class, with the event line and its wrapper hidden: its natural
 * height (`min-height: 0`) and its height as rendered (the min-height applied), "natural/rendered".
 */
async function verdictHeights(page) {
  const style = await page.addStyleTag({
    content:
      "[data-verdict-event], :has(> [data-verdict-event]) { display: none !important; } [data-measure-verdict] { min-height: 0 !important; }",
  });
  const heights = await page.evaluate((classes) => {
    const found = [...document.querySelectorAll("div")].filter((el) => classes.every((c) => el.classList.contains(c)));
    if (found.length !== 1) return `found ${found.length}`;
    const round = (n) => Math.round(n * 100) / 100;
    const rendered = found[0].getBoundingClientRect().height;
    found[0].setAttribute("data-measure-verdict", "");
    const natural = found[0].getBoundingClientRect().height;
    found[0].removeAttribute("data-measure-verdict");
    return `${round(natural)}/${round(rendered)}`;
  }, MIN_HEIGHT_CLASSES);
  await style.evaluate((s) => s.remove());
  return heights;
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();

async function open(view, locale, theme, abort = false) {
  const context = await browser.newContext({ ...VIEWPORTS[view], storageState, serviceWorkers: "block" });
  await context.addCookies([
    { name: "sidereus-theme", value: theme, url: BASE },
    { name: "sidereus-lang", value: locale, url: BASE },
  ]);
  if (abort) await context.route((url) => url.pathname.includes("/_server-islands/"), (route) => route.abort());
  const page = await context.newPage();
  await page.goto(BASE + "/tonight", { waitUntil: "networkidle" });
  if (!abort) await page.locator("[data-tonight-tiles]").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  return { context, page };
}

const box = async (locator) => {
  const b = (await locator.count()) ? await locator.first().boundingBox() : null;
  return b ? Math.round(b.y + b.height) : null;
};
const top = async (locator) => {
  const b = (await locator.count()) ? await locator.first().boundingBox() : null;
  return b ? Math.round(b.y) : null;
};

for (const view of VIEWS) {
  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      const name = `tonight-${view}-${locale}-${theme}`;
      const { context, page } = await open(view, locale, theme);
      await page.screenshot({ path: join(outDir, `${name}-fold.png`) });
      if (measure) {
        const tabbar = await top(page.locator("[data-tabbar]"));
        const style = await page.addStyleTag({ content: "[data-verdict-event]{display:none}" });
        const m = {
          headline: await box(page.locator("#verdict-heading [data-sky-headline]")),
          site: await box(page.locator('[data-gear-card="site"]')),
          telescopeTitle: await box(page.locator('[data-gear-card="telescope"]').locator("label, p")),
          telescope: await box(page.locator('[data-gear-card="telescope"]')),
          firstTile: await top(page.locator("[data-tonight-tiles] a")),
          tabbar,
        };
        await style.evaluate((s) => s.remove());
        const verdict = await page.locator("section[aria-labelledby='verdict-heading']").boundingBox();
        const event = await page.locator("[data-verdict-event]").count();
        const tiles = await page
          .locator("[data-tonight-tiles] > a")
          .evaluateAll((els) => els.map((el) => `${el.getAttribute("href").replace("/tonight/", "")}:${Math.round(el.getBoundingClientRect().height)}`));
        const tilesBlock = await page.locator("[data-tonight-tiles]").boundingBox();
        const real = await page.evaluate(() => document.documentElement.scrollHeight);
        const verdictReal = await verdictHeights(page);
        const skeleton = await open(view, locale, theme, true);
        const skelHeight = await skeleton.page.evaluate(() => document.documentElement.scrollHeight);
        const verdictSkeleton = await verdictHeights(skeleton.page);
        const skelTiles = await skeleton.page
          .locator("[aria-hidden='true'] > div.border-b")
          .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
        await skeleton.context.close();
        console.log(
          `${name} first-screen ${JSON.stringify(m)} verdict=${Math.round(verdict?.height ?? 0)} eventLine=${event} tilesBlock=${Math.round(tilesBlock?.height ?? 0)} tiles=[${tiles.join(" ")}] skeletonTiles=[${skelTiles.join(" ")}] page real=${real} skeleton=${skelHeight} delta=${real - skelHeight} verdictContainer(natural/rendered, ${MIN_HEIGHT_CLASSES.join(" ")}) real=${verdictReal} skeleton=${verdictSkeleton}`,
        );
      }
      await page.addStyleTag({ content: "[data-tabbar] { display: none !important; }" });
      await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true });
      await page.locator("[data-tonight-tiles]").screenshot({ path: join(outDir, `${name}-tiles.png`) });
      console.log("captured", name);
      await context.close();
    }
  }
}
await browser.close();
