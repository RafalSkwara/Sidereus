import { expect, test, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * Top navigation (top-nav-redesign, board direction A): on phones one slim top bar plus a bottom tab bar, from
 * `sm` one row with inline links; theme, language and sign-out in the settings popover. Pins the layout so the
 * old four-row phone header cannot creep back.
 */

const tabBar = (page: Page) => page.locator("nav.fixed", { has: page.getByRole("link", { name: en.nav.log }) });

test("phones get a slim top bar and a bottom tab bar; wide screens one row of links", async ({ page }) => {
  await onboardInMadrid(page, "topnav");

  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/tonight");
  const header = page.locator("header").first();
  expect((await header.boundingBox())?.height).toBeLessThanOrEqual(64);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await expect(tabBar(page)).toBeVisible();
  await expect(tabBar(page).getByRole("link")).toHaveCount(3);
  await expect(tabBar(page).getByRole("link", { name: en.nav.tonight })).toHaveAttribute("aria-current", "page");

  await tabBar(page).getByRole("link", { name: en.nav.log }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(tabBar(page).getByRole("link", { name: en.nav.log })).toHaveAttribute("aria-current", "page");

  // The settings sheet opens from the top bar and Esc closes it.
  await waitForHydration(page, `button[aria-label="${en.nav.settings}"]`);
  await page.getByRole("button", { name: en.nav.settings }).click();
  const sheet = page.getByRole("dialog", { name: en.nav.settings });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: en.nav.signOut })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(tabBar(page)).toBeHidden();
  await expect(header.getByRole("link", { name: en.nav.tonight })).toBeVisible();
  await expect(header.getByRole("link", { name: en.nav.log })).toHaveAttribute("aria-current", "page");
});

test("signed out, phones show Sign in and no tab bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await expect(page.locator("header").getByRole("link", { name: en.nav.signIn })).toBeVisible();
  await expect(page.getByRole("link", { name: en.nav.tonight })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
