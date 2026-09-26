import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE, THEME_COOKIE } from "@/lib/preferences";

/*
 * Captures the landing page's Tonight screenshot (`public/landing/tonight.png`, shown by
 * `src/components/Welcome.astro`) from the same setup as `onboarding.spec.ts`: a production preview on local
 * Supabase with FORECAST_BASE_URL pointing at `tests/e2e/forecast-fixture.mjs`, and place search stubbed with
 * Madrid. Not part of the e2e suite: it only runs with CAPTURE_LANDING=1, and CI never sets it.
 *
 *   CAPTURE_LANDING=1 BASE_URL=http://localhost:4321 npx playwright test landing-screenshot
 *
 * Dark theme and English, 1280×800. Tonight shows the site's name and time zone, never its coordinates.
 */

const OUTPUT = fileURLToPath(new URL("../../public/landing/tonight.png", import.meta.url));
const VIEWPORT = { width: 1280, height: 800 };

const MADRID_RESULT = {
  id: 3117735,
  name: "Madrid",
  latitude: 40.4168,
  longitude: -3.7038,
  admin1: "Madrid",
  country: "Spain",
};
const MADRID_LABEL = "Madrid, Madrid, Spain";

const PASSWORD = "E2e-Test-Passw0rd!";
const SIGNUP_FORM = 'form[action="/api/auth/signup"]';
const ONBOARDING_FORM = 'form[action="/api/onboarding"]';

/** Waits until the React island holding `formSelector` has hydrated (Astro then drops its `ssr` attribute). */
async function waitForHydration(page: Page, formSelector: string) {
  await expect(page.locator(`astro-island[ssr]:has(${formSelector})`)).toHaveCount(0);
}

test.describe("landing screenshot", () => {
  test.skip(process.env.CAPTURE_LANDING !== "1", "captures public/landing/tonight.png only with CAPTURE_LANDING=1");
  test.use({ viewport: VIEWPORT, colorScheme: "dark" });

  test("captures Tonight after onboarding", async ({ page, context, baseURL }) => {
    const url = baseURL ?? "http://localhost:4321";
    await context.addCookies([
      { name: LOCALE_COOKIE, value: "en", url },
      { name: THEME_COOKIE, value: "dark", url },
    ]);
    await page.route("https://geocoding-api.open-meteo.com/**", (route) =>
      route.fulfill({
        json: { results: [MADRID_RESULT] },
        headers: { "Access-Control-Allow-Origin": "*" },
      }),
    );

    // Sign up and onboard with the defaults, as onboarding.spec.ts test (a) does.
    await page.goto("/auth/signup");
    await waitForHydration(page, SIGNUP_FORM);
    const signup = page.locator(SIGNUP_FORM);
    await signup.locator("#email").fill(`e2e-${randomUUID()}@example.com`);
    await signup.locator("#password").fill(PASSWORD);
    await signup.locator("#confirmPassword").fill(PASSWORD);
    await signup.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await waitForHydration(page, ONBOARDING_FORM);

    await page.locator("#place-search").fill("Madrid");
    await page
      .getByRole("list", { name: en.onboarding.where.resultsLabel })
      .getByRole("button", { name: MADRID_LABEL })
      .click();
    await page.locator(`${ONBOARDING_FORM} button[type="submit"]`).click();

    await expect(page).toHaveURL(/\/tonight$/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("#verdict-heading > span").first()).toHaveText(en.verdict.level.go);
    await expect(page.locator('section[aria-labelledby="ranking-heading"] ol > li').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    await page.screenshot({ path: OUTPUT, clip: { x: 0, y: 0, ...VIEWPORT } });
  });
});
