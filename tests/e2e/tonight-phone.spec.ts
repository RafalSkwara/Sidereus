import { expect, test, type Page } from "@playwright/test";

import { STRIP_HEIGHT_PX, STRIP_OVERLAP_PX } from "@/components/tonight/sky-band";
import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid } from "./helpers";

/*
 * The phone-first Tonight, pinned with bounding boxes (ui-mobile-pass, roadmap M-3 S-01); no pixel baselines. Same
 * setup as the other specs: a production preview on local Supabase with the all-clear forecast fixture and place
 * search stubbed with Madrid. Tonight's content is a server island, so each check waits for the island's own
 * elements (and for the fonts, which change line heights) before it measures.
 *
 *  - the first screen at 390×844 (EN): the "Point here first" heading and its first target row end above the fixed
 *    TabBar, and the gear link sits above the tiles. 360×780 and 375×667 are known limits (the plan's "What we're not
 *    doing"), so they are not asserted;
 *  - no sideways scroll at 320×568 and 375×667 on eight pages, in EN and PL;
 *  - the panorama keeps its height (it is untouched by this change).
 */

const LOCALES = ["en", "pl"] as const;

/** Phone widths where nothing may scroll sideways (the smallest supported and the common small iPhone). */
const NARROW_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
];

/** The Tonight dashboard and its focused pages: server-island pages, which render `OfflineCopy` once loaded. */
const TONIGHT_PAGES = [
  "/tonight",
  "/tonight/targets",
  "/tonight/plan",
  "/tonight/moon",
  "/tonight/planets",
  "/tonight/nights",
];
/** The other app pages checked for sideways scroll: plain server-rendered. */
const APP_PAGES = ["/gear", "/log"];

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

/** Waits for the page's content: a Tonight page for its island's copy metadata, others for `main`. */
async function waitForPage(page: Page, path: string) {
  if (TONIGHT_PAGES.includes(path)) {
    await expect(page.locator("[data-offline-copy]").first()).toBeAttached();
  } else {
    await expect(page.locator("main")).toBeVisible();
  }
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

test("the verdict, the gear and the first target row fit one 390×844 screen", async ({ page }) => {
  await onboardInMadrid(page, "e2e-phone");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tonight");
  const tiles = page.locator("[data-tonight-tiles]");
  await expect(tiles).toBeVisible();
  await expect(tiles.locator('a[href="/tonight/targets"] li').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  // The fixed bottom navigation: below `md` it is the only visible navigation named "Main" (the top bar's is hidden).
  const tabBar = await page.getByRole("navigation", { name: en.nav.primary }).boundingBox();
  const heading = await page.locator("#tile-targets-heading").boundingBox();
  const firstRow = await tiles.locator('a[href="/tonight/targets"] li').first().boundingBox();
  const firstTile = await tiles.locator("a").first().boundingBox();
  const gearLink = page.locator('main a[href="/gear"]');
  await expect(gearLink, "the gear link must be visible under the sky").toBeVisible();
  const gear = await gearLink.boundingBox();

  if (!tabBar || !heading || !firstRow || !firstTile || !gear) {
    throw new Error("a box to measure is missing (TabBar, tile heading, first target row, first tile or gear link)");
  }
  expect(
    heading.y + heading.height,
    "the 'Point here first' heading must sit above the TabBar at 390×844",
  ).toBeLessThanOrEqual(tabBar.y);
  expect(firstRow.y + firstRow.height, "first target row must sit above the TabBar at 390×844").toBeLessThanOrEqual(
    tabBar.y,
  );
  expect(gear.y + gear.height, "the gear link must end above the first tile at 390×844").toBeLessThanOrEqual(
    firstTile.y,
  );
});

test("no page scrolls sideways at 320 and 375 px, in English and Polish", async ({ page, context, baseURL }) => {
  test.setTimeout(240_000);
  await onboardInMadrid(page, "e2e-phone-overflow");
  const url = baseURL ?? "http://localhost:4321";

  const overflowing: string[] = [];
  for (const locale of LOCALES) {
    await context.addCookies([{ name: LOCALE_COOKIE, value: locale, url }]);
    for (const viewport of NARROW_VIEWPORTS) {
      await page.setViewportSize(viewport);
      for (const path of [...TONIGHT_PAGES, ...APP_PAGES]) {
        await page.goto(path);
        await waitForPage(page, path);
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        if (scrollWidth > clientWidth) {
          overflowing.push(
            `${path} (${locale}, ${String(viewport.width)}×${String(viewport.height)}): scrollWidth ${String(scrollWidth)} > clientWidth ${String(clientWidth)}`,
          );
        }
      }
    }
  }
  expect(overflowing, "pages that scroll sideways").toEqual([]);
});

test("the panorama keeps its height on a phone and on a desktop", async ({ page }) => {
  await onboardInMadrid(page, "e2e-phone-strip");

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/tonight");
    const svg = page.locator("[data-sky-strip] svg");
    await expect(svg).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const box = await svg.boundingBox();
    expect(
      box?.height,
      `the panorama's height must stay STRIP_HEIGHT_PX + STRIP_OVERLAP_PX at ${String(viewport.width)} px`,
    ).toBe(STRIP_HEIGHT_PX + STRIP_OVERLAP_PX);
  }
});
