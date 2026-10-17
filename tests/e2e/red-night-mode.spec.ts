import { expect, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { THEME_COOKIE } from "@/lib/preferences";
import { onboardInMadrid, test, waitForHydration } from "./helpers";

/*
 * Red night mode (S-10, FR-024) through the top bar's theme button (nav-motion-theme-cycle): each tap moves to the
 * next theme, dark → light → red → dark, and the button names the current and the next one. Red is remembered
 * across reloads and emits no green or blue. The theme tests run on public pages and sign up nobody; the credit-link
 * test signs up one user, since the data credits sit on the gated Tonight pages (ui-quiet-actions).
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

test("a quiet action is underlined at rest in red night mode only", async ({ page, baseURL }) => {
  // "Back to sign in" (a `quiet` action) on the signed-out confirm-email page. The dev server shows the "registered"
  // wording and a production build the "check your email" one, so the name matches either.
  const { checkEmail, registered } = en.auth.confirmEmail;
  const link = page.getByRole("link", { name: new RegExp(`^(${checkEmail.link}|${registered.link})$`) });
  const decoration = () => link.evaluate((el) => getComputedStyle(el).textDecorationLine);

  for (const [value, expected] of [
    ["red", "underline"],
    ["dark", "none"],
  ] as const) {
    await page.context().addCookies([{ name: THEME_COOKIE, value, url: baseURL }]);
    await page.goto("/auth/confirm-email");
    expect(await theme(page)).toBe(value);
    await expect(link).toBeVisible();
    await expect.poll(decoration).toBe(expected);
  }
});

test("the data credit links' underline takes the text colour in red night mode only", async ({ page, baseURL }) => {
  // Their resting underline is `decoration-border`, about 1.17:1 in red, so red mode paints it in the text colour
  // (`red:decoration-current`, ui-quiet-actions plan review F4); the other themes keep the faint rule.
  await onboardInMadrid(page, "e2e-red-credits");
  const link = page.getByRole("link", { name: "OpenNGC" });
  const colours = () =>
    link.evaluate((el) => {
      const style = getComputedStyle(el);
      return style.textDecorationColor === style.color;
    });

  for (const [value, expected] of [
    ["red", true],
    ["dark", false],
  ] as const) {
    await page.context().addCookies([{ name: THEME_COOKIE, value, url: baseURL }]);
    await page.goto("/tonight");
    expect(await theme(page)).toBe(value);
    await expect(link).toBeVisible();
    await expect.poll(colours).toBe(expected);
  }
});
