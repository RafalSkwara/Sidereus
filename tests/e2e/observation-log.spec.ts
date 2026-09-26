import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

/*
 * Mark observed from the ranking, end to end (S-06, FR-016 / FR-018), from the same setup as
 * `onboarding.spec.ts`: a production preview on local Supabase with FORECAST_BASE_URL pointing at
 * `tests/e2e/forecast-fixture.mjs` (an all-clear sky), and place search stubbed with Madrid.
 *
 * The clock is real, so which objects rank (and whether a logged one stays in the top five) varies by date.
 * The spec therefore never asserts a position: the order rule is pinned by the engine's unit tests.
 */

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
const LOG_FORM = 'form[action="/api/log"]';

/** Waits until the React island holding `formSelector` has hydrated (Astro drops its `ssr` attribute then). */
async function waitForHydration(page: Page, formSelector: string) {
  await expect(page.locator(`astro-island[ssr]:has(${formSelector})`)).toHaveCount(0);
}

/** Signs up a fresh user and completes onboarding in Madrid with the default kit, landing on Tonight. */
async function onboardInMadrid(page: Page) {
  await page.route("https://geocoding-api.open-meteo.com/**", (route) =>
    route.fulfill({ json: { results: [MADRID_RESULT] }, headers: { "Access-Control-Allow-Origin": "*" } }),
  );

  await page.goto("/auth/signup");
  await waitForHydration(page, SIGNUP_FORM);
  const signup = page.locator(SIGNUP_FORM);
  await signup.locator("#email").fill(`e2e-log-${randomUUID()}@example.com`);
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
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("marking a ranked object observed saves it and tags it on Tonight", async ({ page }) => {
  await onboardInMadrid(page);

  const ranking = page.locator('section[aria-labelledby="ranking-heading"]');
  const firstCard = ranking.locator("ol > li").first();
  await expect(firstCard).toBeVisible();
  const heading = (await firstCard.getByRole("heading").textContent()) ?? "";
  const id = /\bM\d{1,3}\b/.exec(heading)?.[0];
  if (!id) throw new Error(`no Messier id in the first card's heading: ${heading}`);
  const messier = id.slice(1);

  await firstCard.getByRole("link", { name: en.tonight.object.markObserved }).click();

  // The form arrives prefilled from the ranking, with the rating left to the user.
  await expect(page).toHaveURL(new RegExp(`/log/new\\?object=${messier}&night=\\d{4}-\\d{2}-\\d{2}&site=`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText(en.log.title({ object: id }));
  await waitForHydration(page, LOG_FORM);
  const form = page.locator(LOG_FORM);
  await expect(form.locator("#night")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await expect(form.getByRole("radio", { checked: true })).toHaveCount(0);

  // Without a rating the form stays put and says why.
  await form.locator('button[type="submit"]').click();
  await expect(form.getByText(en.errors.observation.ratingRequired)).toBeVisible();
  await expect(page).toHaveURL(/\/log\/new/);

  // The radios are visually hidden inside their labels; click the label, as a user does.
  await form.locator("label").filter({ hasText: /^4$/ }).click();
  await expect(form.getByRole("radio", { name: "4", exact: true })).toBeChecked();
  await form.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(new RegExp(`/tonight\\?logged=${messier}$`));
  await expect(page.getByRole("status").filter({ hasText: en.tonight.logged({ object: id }) })).toBeVisible();

  // Rated 4, the object is pushed down: it either left the top five or carries the "seen" tag.
  await expect(ranking.locator("ol > li").first()).toBeVisible();
  const loggedCard = ranking.locator("ol > li").filter({
    has: page.getByRole("heading", { name: new RegExp(`\\b${id}\\b`) }),
  });
  if ((await loggedCard.count()) > 0) {
    await expect(loggedCard).toContainText(/Seen 1 time – last /);
  }
});

test("the log form turns away an object outside the Messier catalogue", async ({ page }) => {
  await onboardInMadrid(page);

  await page.goto("/log/new?object=111");

  await expect(page.getByText(en.log.objectNotFound)).toBeVisible();
  await expect(page.locator(LOG_FORM)).toHaveCount(0);
});
