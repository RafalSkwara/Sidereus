import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { pl } from "@/i18n/messages/pl";
import { LOCALE_COOKIE } from "@/lib/preferences";

/*
 * First-run onboarding end to end (S-03). Runs against a production preview backed by local Supabase
 * (email confirmation off, so sign-up leaves the browser signed in), with FORECAST_BASE_URL pointing at
 * `tests/e2e/forecast-fixture.mjs` (an all-clear sky). Place search is stubbed in the browser, so no
 * test talks to Open-Meteo.
 */

// Madrid: at about 40°N there is a dark window in every season.
const MADRID = { latitude: 40.4168, longitude: -3.7038 };
const MADRID_RESULT = {
  id: 3117735,
  name: "Madrid",
  latitude: MADRID.latitude,
  longitude: MADRID.longitude,
  admin1: "Madrid",
  country: "Spain",
};
const MADRID_LABEL = "Madrid, Madrid, Spain";

const PASSWORD = "E2e-Test-Passw0rd!";

const SIGNUP_FORM = 'form[action="/api/auth/signup"]';
const ONBOARDING_FORM = 'form[action="/api/onboarding"]';

/**
 * Waits until the React island holding `formSelector` has hydrated (Astro drops the island's `ssr`
 * attribute then). Typing into the server-rendered markup before that is lost to the controlled inputs.
 */
async function waitForHydration(page: Page, formSelector: string) {
  await expect(page.locator(`astro-island[ssr]:has(${formSelector})`)).toHaveCount(0);
}

async function signUp(page: Page) {
  const email = `e2e-${randomUUID()}@example.com`;
  await page.goto("/auth/signup");
  await waitForHydration(page, SIGNUP_FORM);
  const form = page.locator(SIGNUP_FORM);
  await form.locator("#email").fill(email);
  await form.locator("#password").fill(PASSWORD);
  await form.locator("#confirmPassword").fill(PASSWORD);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await waitForHydration(page, ONBOARDING_FORM);
}

/** The onboarding form's own submit button: the top bar has a sign-out submit button too. */
function onboardingSubmit(page: Page) {
  return page.locator(`${ONBOARDING_FORM} button[type="submit"]`);
}

async function pinEnglish(context: BrowserContext, baseURL: string | undefined) {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
}

test.describe("onboarding in English", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await pinEnglish(context, baseURL);
  });

  test("place search leads to a ranked Tonight", async ({ page }) => {
    await page.route("https://geocoding-api.open-meteo.com/**", (route) =>
      route.fulfill({
        json: { results: [MADRID_RESULT] },
        headers: { "Access-Control-Allow-Origin": "*" },
      }),
    );

    await signUp(page);

    await page.locator("#place-search").fill("Madrid");
    const results = page.getByRole("list", { name: en.onboarding.where.resultsLabel });
    await results.getByRole("button", { name: MADRID_LABEL }).click();
    await expect(page.getByText(en.onboarding.where.usingPlace({ place: MADRID_LABEL }))).toBeVisible();

    // Defaults stay: "Suburb", the 150 mm reflector and the Supplied pair.
    await expect(page.getByRole("radio", { name: new RegExp(`^${en.onboarding.scenes.suburb.title}`) })).toBeChecked();
    await expect(page.getByRole("radio", { name: new RegExp(`^${en.onboarding.telescopes.n150}`) })).toBeChecked();
    await expect(page.getByRole("radio", { name: new RegExp(`^${en.onboarding.eyepieceKits.pair}`) })).toBeChecked();

    await onboardingSubmit(page).click();

    await expect(page).toHaveURL(/\/tonight$/);
    await expect(page.locator("#verdict-heading > span").first()).toHaveText(en.verdict.level.go);
    const ranking = page.locator('section[aria-labelledby="ranking-heading"]');
    await expect(ranking.locator("ol > li").first()).toBeVisible();
    await expect(ranking.getByText(/25 mm/).first()).toBeVisible();
  });

  test.describe("with geolocation", () => {
    test.use({ geolocation: MADRID, permissions: ["geolocation"] });

    test("'Use my location' sets the location and enables submit", async ({ page }) => {
      await signUp(page);
      await expect(onboardingSubmit(page)).toBeDisabled();

      await page.getByRole("button", { name: en.onboarding.where.useLocation }).click();

      await expect(page.getByText(en.onboarding.where.usingDevice)).toBeVisible();
      await expect(onboardingSubmit(page)).toBeEnabled();
    });
  });

  test("abandoned onboarding: Tonight offers the way back to setup", async ({ page }) => {
    await signUp(page);

    await page.goto("/tonight");

    await expect(page.getByText(en.tonight.setupPrompt)).toBeVisible();
    await expect(page.getByRole("link", { name: en.tonight.setup, exact: true })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });
});

test.describe("onboarding in a Polish browser", () => {
  test.use({ locale: "pl-PL" });

  test("renders in Polish without a language cookie", async ({ page }) => {
    await signUp(page);

    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await expect(onboardingSubmit(page)).toHaveText(pl.onboarding.submit);
  });
});
