import { expect, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE, THEME_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, test } from "./helpers";

/*
 * The quick nav (ui-quick-nav, roadmap S-10): one Topbar button on every signed-in screen opens Tonight's seven pages.
 * This journey is the only protection of its keyboard and screen-reader contract (disclosure navigation: a button with
 * `aria-expanded`, then a list of links): keyboard only from `/log`, focus moves into the panel, the arrows walk the
 * rows, Enter follows a link, the next opening lands on the current page's row (`aria-current="page"`), Esc closes and
 * returns focus. The panel carries the page theme (it sits in the Tonight `night-sky` scope). Signed out there is no
 * button. Rows are found with `exact: true`: "Plan" is a substring of "Planets". The swipe to close is in
 * `sheet-swipe.spec.ts`; the 320 / 768 px fit in `navigation.spec.ts`.
 */

const t = en.tonight.subnav;
const trigger = (page: Page) => page.getByRole("button", { name: t.label });
const panel = (page: Page) => page.locator("[data-quick-nav-panel]");
const row = (page: Page, name: string) => panel(page).getByRole("link", { name, exact: true });

/** Tabs from the top of the page to the quick-nav button: fails after 20 presses rather than looping. */
async function tabToTrigger(page: Page) {
  for (let presses = 0; presses < 20; presses += 1) {
    await page.keyboard.press("Tab");
    const onTrigger = await page.evaluate(
      () => document.activeElement?.hasAttribute("data-quick-nav-trigger") ?? false,
    );
    if (onTrigger) return;
  }
  throw new Error("the quick-nav button is not reachable with Tab within 20 presses");
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("keyboard only, the quick nav opens Tonight's pages from the log and marks the current one", async ({
  page,
  baseURL,
}) => {
  // Signed out (the landing): no quick nav at all.
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("[data-quick-nav]")).toHaveCount(0);

  await onboardInMadrid(page, "e2e-quick-nav");
  await page.context().addCookies([{ name: THEME_COOKIE, value: "light", url: baseURL ?? "http://localhost:4321" }]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/log");
  await expect(page.locator("main")).toBeVisible();

  await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("navigation", { name: en.nav.quickNav })).toBeVisible();

  // Open from the keyboard: focus lands on the first row (no Tonight page is current on /log).
  await tabToTrigger(page);
  await page.keyboard.press("Enter");
  await expect(panel(page)).toBeVisible();
  await expect(trigger(page)).toHaveAttribute("aria-expanded", "true");
  await expect(panel(page)).toHaveAttribute("data-theme", "light");
  await expect(panel(page).getByRole("link")).toHaveCount(7);
  await expect(panel(page).locator('[aria-current="page"]')).toHaveCount(0);
  await expect(row(page, t.tonight)).toBeFocused();

  // Down the list to the Moon (Tonight, Targets, Events, Plan, Moon) and follow it.
  for (let step = 0; step < 4; step += 1) await page.keyboard.press("ArrowDown");
  await expect(row(page, t.moon)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/tonight\/moon$/);
  await expect(
    page.getByRole("navigation", { name: t.label }).getByRole("link", { name: t.moon, exact: true }),
  ).toHaveAttribute("aria-current", "page");

  // Opened again on the Moon page, the menu lands on its current row.
  await tabToTrigger(page);
  await page.keyboard.press("Enter");
  await expect(row(page, t.moon)).toHaveAttribute("aria-current", "page");
  await expect(row(page, t.moon)).toBeFocused();
  // End and Home reach the last and first rows.
  await page.keyboard.press("End");
  await expect(row(page, t.nights)).toBeFocused();
  await page.keyboard.press("Home");
  await expect(row(page, t.tonight)).toBeFocused();

  // Esc closes and gives focus back to the button.
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");
  await expect(trigger(page)).toBeFocused();
});
