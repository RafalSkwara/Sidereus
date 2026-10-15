import { expect, test, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { pl } from "@/i18n/messages/pl";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid } from "./helpers";

/*
 * The four destinations (ui-tonight-nav Phase 1): Tonight, Log, Progress and My gear in the phone TabBar and the
 * Topbar pill. Polish carries the longest labels, so the fit checks run in Polish: the TabBar at 320 px (four equal
 * cells, no label spilling out of its cell) and the Topbar row at 768 px (text-only segments) and 1024 px (segments
 * with their icons). Then one current item per bar: on `/log/progress` it is Progress, never Progress and Log, which
 * would duplicate the view-transition names. Plain server-rendered pages, so each check waits for `main` and the fonts.
 */

const BARS = {
  tabBar: "[data-tabbar]",
  topbar: "header nav",
} as const;

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

async function usePolish(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([{ name: LOCALE_COOKIE, value: "pl", url: baseURL ?? "http://localhost:4321" }]);
}

async function openPage(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("main")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test("the TabBar's four Polish tabs fit a 320 px phone", async ({ page, baseURL }) => {
  await onboardInMadrid(page, "e2e-nav-tabbar");
  await usePolish(page, baseURL);
  await page.setViewportSize({ width: 320, height: 700 });
  await openPage(page, "/log");

  const tabs = page.locator(`${BARS.tabBar} a`);
  await expect(tabs).toHaveCount(4);
  await expect(tabs).toHaveText([pl.nav.tonight, pl.nav.log, pl.nav.progress, pl.nav.myGear]);

  // Each tab: no overflow inside the link, and its label's text box inside the link's box.
  const spills = await tabs.evaluateAll((links) =>
    links.flatMap((link) => {
      const box = link.getBoundingClientRect();
      const text = [...link.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
      const range = document.createRange();
      if (text) range.selectNodeContents(text);
      const label = text ? range.getBoundingClientRect() : null;
      const name = link.textContent.trim();
      const problems: string[] = [];
      if (link.scrollWidth > link.clientWidth) {
        problems.push(`${name}: scrollWidth ${String(link.scrollWidth)} > clientWidth ${String(link.clientWidth)}`);
      }
      if (!label) {
        problems.push(`${name}: no label text`);
      } else if (label.left < box.left || label.right > box.right) {
        problems.push(
          `${name}: label ${String(label.left)}-${String(label.right)} outside the cell ${String(box.left)}-${String(box.right)}`,
        );
      }
      return problems;
    }),
  );
  expect(spills, "tabs whose label spills out of their cell at 320 px").toEqual([]);
});

test("the Topbar row with four Polish segments fits at 768 and 1024 px", async ({ page, baseURL }) => {
  await onboardInMadrid(page, "e2e-nav-topbar");
  await usePolish(page, baseURL);

  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await openPage(page, "/log");

    const pill = page.locator(BARS.topbar);
    await expect(pill).toBeVisible();
    await expect(pill.getByRole("link")).toHaveCount(4);

    const header = await page.locator("header").evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(header.scrollWidth, `the Topbar row must not overflow at ${String(width)} px`).toBeLessThanOrEqual(
      header.clientWidth,
    );

    const pillBox = await pill.boundingBox();
    // The controls: the theme and settings buttons' row, the settings button's parent.
    const controls = await page.getByRole("button", { name: pl.nav.settings }).locator("..").boundingBox();
    if (!pillBox || !controls) throw new Error("the pill or the Topbar controls are missing");
    expect(
      pillBox.x + pillBox.width,
      `the pill must end left of the controls at ${String(width)} px`,
    ).toBeLessThanOrEqual(controls.x);
  }
});

test("each bar marks exactly one current destination", async ({ page }) => {
  await onboardInMadrid(page, "e2e-nav-current");

  for (const [path, label] of [
    ["/log/progress", en.nav.progress],
    ["/log", en.nav.log],
    ["/log/sky", en.nav.log],
  ] as const) {
    await openPage(page, path);
    // Both bars are in the DOM at every width (one is hidden by CSS), so count in each regardless of visibility.
    for (const [bar, selector] of Object.entries(BARS)) {
      const current = page.locator(`${selector} [aria-current="page"]`);
      await expect(current, `${bar} on ${path}: one current item`).toHaveCount(1);
      await expect(current, `${bar} on ${path}: the current item`).toHaveText(label);
    }
  }
});
