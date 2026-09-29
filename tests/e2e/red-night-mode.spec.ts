import { expect, test, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { RETURN_THEME_COOKIE, THEME_COOKIE } from "@/lib/preferences";
import { waitForHydration } from "./helpers";

/*
 * Red night mode (S-10, FR-024) from the top bar (top-nav-redesign): the eye button turns the page red at once,
 * red is remembered across reloads and emits no green or blue, and the eye turns it off again back to whichever
 * day theme was in use. Runs on the public landing page, so it signs up nobody.
 */

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const cookie = async (page: Page, name: string) => (await page.context().cookies()).find((c) => c.name === name)?.value;

test("the eye turns red night mode on and off, back to the theme in use before", async ({ page }) => {
  await page.goto("/");
  // The controls are a React island: wait until React has hydrated the settings button.
  await waitForHydration(page, `button[aria-label="${en.nav.settings}"]`);

  // The eye comes first in the header; the settings panel's Red segment only exists while the panel is open.
  const eye = page.getByRole("button", { name: en.preferences.red }).first();
  await eye.click();
  expect(await theme(page)).toBe("red");
  await expect(eye).toHaveAttribute("aria-pressed", "true");
  expect(await cookie(page, THEME_COOKIE)).toBe("red");
  expect(await cookie(page, RETURN_THEME_COOKIE)).toBe("dark");

  await page.reload();
  expect(await theme(page)).toBe("red");

  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [, green, blue] = (background.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  expect(green).toBe(0);
  expect(blue).toBe(0);

  const imageFilter = await page
    .locator("main img")
    .first()
    .evaluate((img) => getComputedStyle(img).filter);
  expect(imageFilter).toContain("red-only");

  await waitForHydration(page, `button[aria-label="${en.nav.settings}"]`);
  await eye.click();
  expect(await theme(page)).toBe("dark");

  // Choose light in settings: the eye now returns to light.
  const settings = page.getByRole("button", { name: en.nav.settings });
  await settings.click();
  const panel = page.getByRole("dialog", { name: en.nav.settings });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: en.preferences.light }).click();
  expect(await theme(page)).toBe("light");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(settings).toBeFocused();

  await eye.click();
  expect(await theme(page)).toBe("red");
  await eye.click();
  expect(await theme(page)).toBe("light");
});
