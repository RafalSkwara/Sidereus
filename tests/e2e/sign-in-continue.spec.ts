import { expect, test } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { PASSWORD, onboardInMadrid, signOut, waitForHydration } from "./helpers";

/*
 * Continue after sign-in (S-09, PRD Access Control): a signed-out visit to a gated page goes to sign-in, which
 * says why, and signing in lands on the page that was asked for rather than on Tonight.
 */

const SIGNIN_FORM = 'form[action="/api/auth/signin"]';

test("a signed-out visit to the log continues to the log after sign-in", async ({ page }) => {
  const email = await onboardInMadrid(page, "continue");

  await signOut(page);
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/log");
  await expect(page).toHaveURL(/\/auth\/signin\?next=%2Flog$/);
  await expect(page.getByText(en.auth.signIn.continueNote)).toBeVisible();

  await waitForHydration(page, SIGNIN_FORM);
  const form = page.locator(SIGNIN_FORM);
  await form.locator("#email").fill(email);
  await form.locator("#password").fill(PASSWORD);
  await form.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/log$/);
});
