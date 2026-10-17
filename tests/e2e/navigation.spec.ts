import { expect, type Page } from "@playwright/test";

import { pl } from "@/i18n/messages/pl";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, test } from "./helpers";

/*
 * The four destinations (ui-tonight-nav Phase 1): Tonight, Log, Progress and My gear in the phone TabBar and the
 * Topbar pill. Polish carries the longest labels, so the fit checks run in Polish: the TabBar and the Topbar row at
 * 320 px (four equal cells, no label spilling out of its cell; the row with the quick nav keeps its 16 px gutter,
 * ui-quick-nav D8) and the Topbar row at 768 px (text-only segments, each on one line, D9) and 1024 px (segments with
 * their icons). The one-current-item-per-bar check lives in `tonight-subnav.spec.ts`. Plain server-rendered pages,
 * so each check waits for `main` and the fonts.
 */

const BARS = {
  tabBar: "[data-tabbar]",
  topbar: "header [data-topbar-nav]",
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

test("the TabBar's four Polish tabs and the Topbar row fit a 320 px phone", async ({ page, baseURL }) => {
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

  // The Topbar row with the quick nav (ui-quick-nav D8): no overflow inside the header, and the last control (the
  // settings button) keeps the page's 16 px gutter. The document-level sideways check in tonight-phone.spec.ts cannot
  // see an overflow that lands in the page padding.
  await expect(page.locator("[data-quick-nav-trigger]")).toBeVisible();
  const row = await page.locator("header").evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(row.scrollWidth, "the Topbar row must not overflow at 320 px").toBeLessThanOrEqual(row.clientWidth);
  const settings = await page.getByRole("button", { name: pl.nav.settings }).boundingBox();
  if (!settings) throw new Error("the settings button is missing");
  expect(
    row.viewport - (settings.x + settings.width),
    "the last Topbar control must end at least 16 px from the screen's right edge at 320 px",
  ).toBeGreaterThanOrEqual(16);
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

    // Each segment's label on one line (ui-quick-nav D9): one client rect for its text.
    const wrapped = await pill.getByRole("link").evaluateAll((links) =>
      links.flatMap((link) => {
        const text = [...link.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
        if (!text) return [`${link.textContent.trim()}: no label text`];
        const range = document.createRange();
        range.selectNodeContents(text);
        const lines = range.getClientRects().length;
        return lines === 1 ? [] : [`${link.textContent.trim()}: ${String(lines)} lines`];
      }),
    );
    expect(wrapped, `pill labels that wrap at ${String(width)} px`).toEqual([]);

    const pillBox = await pill.boundingBox();
    // The controls start at the quick-nav button, the first of the three (review F3).
    const controls = await page.locator("[data-quick-nav-trigger]").boundingBox();
    if (!pillBox || !controls) throw new Error("the pill or the Topbar controls are missing");
    expect(
      pillBox.x + pillBox.width,
      `the pill must end left of the controls at ${String(width)} px`,
    ).toBeLessThanOrEqual(controls.x);
  }
});
