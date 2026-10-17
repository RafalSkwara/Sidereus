import { expect, type Page } from "@playwright/test";

import { STRIP_HEIGHT_PX, STRIP_OVERLAP_PX } from "@/components/tonight/sky-band";
import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, planEditable, requirePlanGrant, setPlan, test, waitForHydration } from "./helpers";

/*
 * The phone-first Tonight, pinned with bounding boxes (ui-mobile-pass, roadmap M-3 S-01); no pixel baselines. Same
 * setup as the other specs: a production preview on local Supabase with the all-clear forecast fixture and place
 * search stubbed with Madrid. Tonight's content is a server island, so each check waits for the island's own
 * elements (and for the fonts, which change line heights) before it measures.
 *
 *  - the first screen at 390×844 (EN): the verdict's headline and the Site card (the Site and Telescope cards stack on
 *    a phone) end above the fixed TabBar, and the Telescope card's title shows above it too; the rest of the
 *    Telescope card, the first tile and the first target need a short scroll (the user's decision of 2026-10-08,
 *    ui-user-adjustments: a gear card gives the name its own line with Manage under it). 360×780 and 375×667 are
 *    known limits (the plan's "What we're not doing"), so they are not asserted. On a night with a notable sky event
 *    the verdict grows by one muted line (`[data-verdict-event]`, sky-events, plan review F3: no reserved room). At
 *    390 px the verdict fills its min-height exactly, so nothing swallows the line: it moves the cards down by 28 px
 *    (`mt-line` 8 + the 20 px line), which leaves the Telescope title about 5 px above the TabBar for a one-line event
 *    (ui-dashboard-tiles impl review F1). The spec hides that line while it measures, so it holds on any date (sky-events
 *    impl review F9). The line is a `Fact` (ui-dashboard-tiles D4) in an `mt-line` wrapper, with the
 *    marker on its root: the spec hides the wrapper, so the icon and the wrapper's margin go too;
 *  - no sideways scroll at 320×568 and 375×667 on nine pages, in EN and PL, and none with the Session plan's editor open
 *    (adjustable-session-plan Phase 5: a full-plan user, granted through the operator command; skipped on a night that
 *    does not pass);
 *  - the panorama keeps its height, `STRIP_HEIGHT_PX` plus the `-mt-16` overlap (`STRIP_OVERLAP_PX`, 64 px).
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
  "/tonight/events",
];
/** The other app pages checked for sideways scroll: plain server-rendered. */
const APP_PAGES = ["/gear", "/log", "/log/progress"];

// The first screen, the editor and the suggested plan are the pinned evening's (a dark, clear, editable night).
test.use({ clock: "evening" });

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

/**
 * Hides the verdict's event line (present only on an event night) with its `mt-line` wrapper, so neither its height nor
 * the wrapper's margin counts, and returns the style to remove again afterwards.
 */
async function hideEventLine(page: Page) {
  return page.addStyleTag({ content: ":has(> [data-verdict-event]), [data-verdict-event]{display:none}" });
}

// The user's fold (2026-10-08): the verdict and the Site card fit the first 390×844 screen, and the Telescope card
// starts on it (its title shows above the TabBar). On phones each card gives the name its own line with Manage under it,
// so the Telescope card's lower part needs a short scroll, as the first target does.
test("the verdict, the Site card and the Telescope card's title fit one 390×844 screen", async ({ page }) => {
  await onboardInMadrid(page, "e2e-phone");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tonight");
  const tiles = page.locator("[data-tonight-tiles]");
  await expect(tiles).toBeVisible();
  const siteCard = page.locator('[data-gear-card="site"]');
  const telescopeCard = page.locator('[data-gear-card="telescope"]');
  await expect(siteCard, "the Site card must be visible under the sky").toBeVisible();
  await expect(telescopeCard, "the Telescope card must be visible under the sky").toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  // The fixed bottom navigation: below `md` it is the only visible navigation named "Main" (the top bar's is hidden).
  const tabBar = await page.getByRole("navigation", { name: en.nav.primary }).boundingBox();
  // The event line sits in flow under the verdict's reason and moves the cards down by its 28 px (at 390 px the verdict's
  // min-height has no slack to swallow it), so measure without it: the checks below read the same on event and no-event
  // nights.
  const eventLineStyle = await hideEventLine(page);
  const headline = await page.locator("#verdict-heading [data-sky-headline]").boundingBox();
  const site = await siteCard.boundingBox();
  const telescope = await telescopeCard.boundingBox();
  const telescopeTitle = await telescopeCard.locator("label, p").first().boundingBox();
  const firstTile = await tiles.locator("a").first().boundingBox();
  await eventLineStyle.evaluate((style) => {
    style.parentNode?.removeChild(style);
  });

  if (!tabBar || !headline || !site || !telescope || !telescopeTitle || !firstTile) {
    throw new Error("a box to measure is missing (TabBar, verdict headline, a gear card or the first tile)");
  }
  expect(
    headline.y + headline.height,
    "the verdict's headline must sit above the TabBar at 390×844",
  ).toBeLessThanOrEqual(tabBar.y);
  // On a phone the cards stack: the Site card first, the Telescope card second.
  expect(site.y + site.height, "the Site card must sit above the Telescope card at 390×844").toBeLessThanOrEqual(
    telescope.y,
  );
  expect(site.y + site.height, "the Site card must end above the TabBar at 390×844").toBeLessThanOrEqual(tabBar.y);
  expect(
    telescopeTitle.y + telescopeTitle.height,
    "the Telescope card's title must show above the TabBar at 390×844",
  ).toBeLessThanOrEqual(tabBar.y);
  expect(telescope.y + telescope.height, "the cards must end above the first tile at 390×844").toBeLessThanOrEqual(
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

test("the open plan editor does not scroll sideways at 320 and 375 px, in English and Polish", async ({
  page,
  context,
  baseURL,
}) => {
  requirePlanGrant("tonight-phone");
  test.setTimeout(180_000);
  const email = await onboardInMadrid(page, "e2e-phone-editor");
  await setPlan(email, "full");
  const url = baseURL ?? "http://localhost:4321";

  const overflowing: string[] = [];
  for (const locale of LOCALES) {
    await context.addCookies([{ name: LOCALE_COOKIE, value: locale, url }]);
    for (const viewport of NARROW_VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto("/tonight/plan");
      expect(await planEditable(page), "a fresh full-plan user's plan is editable").toBe(true);
      const edit = '[data-plan-editor="closed"] button';
      await waitForHydration(page, edit);
      await page.locator(edit).click();
      await expect(page.locator('[data-plan-editor="open"]')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      if (scrollWidth > clientWidth) {
        overflowing.push(
          `the open editor (${locale}, ${String(viewport.width)}×${String(viewport.height)}): scrollWidth ${String(scrollWidth)} > clientWidth ${String(clientWidth)}`,
        );
      }
    }
  }
  expect(overflowing, "the open editor scrolls sideways").toEqual([]);
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
