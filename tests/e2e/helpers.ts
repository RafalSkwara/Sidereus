import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";

/*
 * Shared steps for the e2e specs. They run against a production preview on local Supabase with
 * FORECAST_BASE_URL pointing at `tests/e2e/forecast-fixture.mjs` (an all-clear sky); place search is stubbed
 * with Madrid, so no spec depends on Open-Meteo's geocoding.
 */

export const MADRID_RESULT = {
  id: 3117735,
  name: "Madrid",
  latitude: 40.4168,
  longitude: -3.7038,
  admin1: "Madrid",
  country: "Spain",
};
export const MADRID_LABEL = "Madrid, Madrid, Spain";

export const PASSWORD = "E2e-Test-Passw0rd!";

export const SIGNUP_FORM = 'form[action="/api/auth/signup"]';
export const ONBOARDING_FORM = 'form[action="/api/onboarding"]';

/** Waits until the React island holding `formSelector` has hydrated (Astro drops its `ssr` attribute then). */
export async function waitForHydration(page: Page, formSelector: string) {
  await expect(page.locator(`astro-island[ssr]:has(${formSelector})`)).toHaveCount(0);
}

/** Answers Open-Meteo's place search with Madrid. */
export async function stubPlaceSearch(page: Page) {
  await page.route("https://geocoding-api.open-meteo.com/**", (route) =>
    route.fulfill({ json: { results: [MADRID_RESULT] }, headers: { "Access-Control-Allow-Origin": "*" } }),
  );
}

/** Signs up a fresh user (`<emailPrefix>-<uuid>@example.com`) and lands on /onboarding. */
export async function signUp(page: Page, emailPrefix: string) {
  await page.goto("/auth/signup");
  await waitForHydration(page, SIGNUP_FORM);
  const signup = page.locator(SIGNUP_FORM);
  await signup.locator("#email").fill(`${emailPrefix}-${randomUUID()}@example.com`);
  await signup.locator("#password").fill(PASSWORD);
  await signup.locator("#confirmPassword").fill(PASSWORD);
  await signup.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await waitForHydration(page, ONBOARDING_FORM);
}

/** Signs up a fresh user and completes onboarding in Madrid with the default kit, landing on Tonight. */
export async function onboardInMadrid(page: Page, emailPrefix: string) {
  await stubPlaceSearch(page);
  await signUp(page, emailPrefix);

  await page.locator("#place-search").fill("Madrid");
  await page
    .getByRole("list", { name: en.onboarding.where.resultsLabel })
    .getByRole("button", { name: MADRID_LABEL })
    .click();
  await page.locator(`${ONBOARDING_FORM} button[type="submit"]`).click();
  await expect(page).toHaveURL(/\/tonight$/);
}
