import { expect, test, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { THEME_COOKIE } from "@/lib/preferences";
import { waitForHydration } from "./helpers";

/*
 * Red night mode (S-10, FR-024): the third theme segment turns the page red at once, is remembered across
 * reloads, and emits no green or blue. Runs on the public landing page, so it signs up nobody.
 */

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

test("red night mode is chosen from the top bar, survives a reload and switches back", async ({ page, context }) => {
  await page.goto("/");
  // The switch is a React island: wait until React has hydrated the theme group.
  await waitForHydration(page, `[role="group"][aria-label="${en.preferences.theme}"]`);

  const redSegment = page.getByRole("button", { name: en.preferences.red });
  await redSegment.click();

  expect(await theme(page)).toBe("red");
  await expect(redSegment).toHaveAttribute("aria-pressed", "true");
  const cookie = (await context.cookies()).find((c) => c.name === THEME_COOKIE);
  expect(cookie?.value).toBe("red");

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

  await page.getByRole("button", { name: en.preferences.dark }).click();
  expect(await theme(page)).toBe("dark");
});
