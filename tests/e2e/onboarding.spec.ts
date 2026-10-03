import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { MADRID_LABEL, MADRID_RESULT, ONBOARDING_FORM, signUp, stubPlaceSearch } from "./helpers";

/*
 * First-run onboarding end to end (S-03). Runs against a production preview backed by local Supabase
 * (email confirmation off, so sign-up leaves the browser signed in), with FORECAST_BASE_URL pointing at
 * `tests/e2e/forecast-fixture.mjs` (an all-clear sky). Place search is stubbed in the browser, so no
 * test talks to Open-Meteo.
 */

// Madrid: at about 40°N there is a dark window in every season.
const MADRID = { latitude: MADRID_RESULT.latitude, longitude: MADRID_RESULT.longitude };

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
    await stubPlaceSearch(page);

    await signUp(page, "e2e");

    await page.locator("#place-search").fill("Madrid");
    const results = page.getByRole("list", { name: en.location.resultsLabel });
    await results.getByRole("button", { name: MADRID_LABEL }).click();
    await expect(page.getByText(en.location.usingPlace({ place: MADRID_LABEL }))).toBeVisible();

    // Defaults stay: "Suburb", the 150 mm reflector and the Supplied pair.
    await expect(page.getByRole("radio", { name: new RegExp(`^${en.onboarding.scenes.suburb.title}`) })).toBeChecked();
    await expect(page.getByRole("radio", { name: new RegExp(`^${en.onboarding.telescopes.n150}`) })).toBeChecked();
    await expect(page.getByRole("radio", { name: new RegExp(`^${en.onboarding.eyepieceKits.pair}`) })).toBeChecked();

    await onboardingSubmit(page).click();

    await expect(page).toHaveURL(/\/tonight$/);
    // The fixture's all-clear sky: the "Clear" headline, by its catalogue key and its text.
    const headline = page.locator("#verdict-heading [data-sky-headline]");
    await expect(headline).toHaveAttribute("data-sky-headline", "verdict.level.go");
    await expect(headline).toHaveText(en.verdict.level.go);
    const ranking = page.locator('section[aria-labelledby="ranking-heading"]');
    await expect(ranking.locator("ol > li").first()).toBeVisible();
    await expect(ranking.getByText(/25 mm/).first()).toBeVisible();
  });

  test.describe("with geolocation", () => {
    test.use({ geolocation: MADRID, permissions: ["geolocation"] });

    test("'Use my location' sets the location and enables submit", async ({ page }) => {
      await signUp(page, "e2e");
      await expect(onboardingSubmit(page)).toBeDisabled();

      await page.getByRole("button", { name: en.location.useLocation }).click();

      await expect(page.getByText(en.location.usingDevice)).toBeVisible();
      await expect(onboardingSubmit(page)).toBeEnabled();
    });
  });

  test("abandoned onboarding: Tonight offers the way back to setup", async ({ page }) => {
    await signUp(page, "e2e");

    await page.goto("/tonight");

    await expect(page.getByText(en.tonight.setupPrompt)).toBeVisible();
    await expect(page.getByRole("link", { name: en.tonight.setup, exact: true })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });
});
