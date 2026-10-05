import { expect, test } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";
import { signUp } from "./helpers";

/*
 * The landing page (ui-landing): `/` is for signed-out visitors only. Its look is checked by screenshots; this pins
 * what they can't show: where the two calls to action lead, and that a signed-in user is sent on to Tonight.
 */

test("signed out, the landing page offers sign-up first and sign-in second", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.landing.tagline);
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: en.landing.getStarted })).toHaveAttribute("href", "/auth/signup");
  await expect(main.getByRole("link", { name: en.landing.signIn })).toHaveAttribute("href", "/auth/signin");
});

test("signed in, `/` redirects to Tonight", async ({ page }) => {
  await signUp(page, "e2e-landing");

  await page.goto("/");
  await expect(page).toHaveURL(/\/tonight$/);
});
