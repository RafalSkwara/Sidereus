import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import {
  ONBOARDING_FORM_PREFIX,
  completeOnboardingInMadrid,
  fillSignUpForm,
  stubPlaceSearch,
  test,
  waitForHydration,
  waitForServiceWorker,
} from "./helpers";

/*
 * Sign-up continues to the page the visitor asked for (M-4 S-06, auth-loose-ends D2). The risk this spec alone
 * protects is a break in the browser path no HTTP step can show: the sign-in page's "Sign up" link carrying `next`,
 * the form submitting through the service worker's `POST /api/auth/signup` route (the worker is made active first),
 * and onboarding handing the user on to `next`. The signed-in half (D1) and the redirect keys are smoke steps.
 */

function pathAndSearch(page: Page): string {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}`;
}

test("a visitor sent to sign in from a gated page signs up, onboards and lands on that page", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
  await stubPlaceSearch(page);

  // Signed out, a gated page sends the visitor to sign in with the page to come back to.
  await page.goto("/log");
  await expect.poll(() => pathAndSearch(page)).toBe("/auth/signin?next=%2Flog");

  // The sign-up POST must go through the worker's route, not straight to the network.
  await waitForServiceWorker(page);

  await page.getByRole("link", { name: en.auth.signIn.signUpLink }).click();
  await expect.poll(() => pathAndSearch(page)).toBe("/auth/signup?next=%2Flog");
  await fillSignUpForm(page, `e2e-continue-${randomUUID()}@example.com`);

  // A brand-new user has no gear: first-run setup comes first and keeps the page asked for.
  await expect.poll(() => pathAndSearch(page)).toBe("/onboarding?next=%2Flog");
  await waitForHydration(page, ONBOARDING_FORM_PREFIX);
  await completeOnboardingInMadrid(page);

  await expect(page).toHaveURL(/\/log$/);
});
