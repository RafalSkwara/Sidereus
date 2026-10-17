import { expect, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { THEME_COOKIE } from "@/lib/preferences";
import { test, waitForHydration } from "./helpers";

/*
 * Red night mode (S-10, FR-024) through the top bar's theme button (nav-motion-theme-cycle): each tap moves to the
 * next theme, dark → light → red → dark, and the button names the current and the next one. Red is remembered
 * across reloads and emits no green or blue. It runs on a public page and signs up nobody. Red mode's resting
 * underline on quiet actions and credit links is a stylesheet rule, not asserted here (test-suite-diet); offline.spec.ts
 * still checks that an offline quiet link loses it.
 */

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const cookie = async (page: Page, name: string) => (await page.context().cookies()).find((c) => c.name === name)?.value;
const themeButton = (page: Page, current: string, next: string) =>
  page.getByRole("button", { name: en.preferences.cycle({ current, next }) });
const { darkShort: dark, lightShort: light, redShort: red } = en.preferences;

test("the theme button cycles dark, light and red, and red keeps its guarantees", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page, `button[aria-label="${en.nav.settings}"]`);

  await themeButton(page, dark, light).click();
  expect(await theme(page)).toBe("light");
  await themeButton(page, light, red).click();
  expect(await theme(page)).toBe("red");
  expect(await cookie(page, THEME_COOKIE)).toBe("red");

  await page.reload();
  expect(await theme(page)).toBe("red");
  await expect(themeButton(page, red, dark)).toBeVisible();

  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [, green, blue] = (background.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  expect(green).toBe(0);
  expect(blue).toBe(0);

  await waitForHydration(page, `button[aria-label="${en.nav.settings}"]`);
  await themeButton(page, red, dark).click();
  expect(await theme(page)).toBe("dark");

  // The settings control and the button share one state: picking Red there makes the button offer Dark next.
  const settings = page.getByRole("button", { name: en.nav.settings });
  await settings.click();
  const panel = page.getByRole("dialog", { name: en.nav.settings });
  await expect(panel.getByRole("button", { name: en.preferences.dark })).toHaveAttribute("aria-pressed", "true");
  await panel.getByRole("button", { name: en.preferences.red }).click();
  expect(await theme(page)).toBe("red");
  await page.keyboard.press("Escape");

  await themeButton(page, red, dark).click();
  expect(await theme(page)).toBe("dark");
});
