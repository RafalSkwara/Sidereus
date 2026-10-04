import { expect, test, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * "Use my location" on the add/edit site form (S-08). The browser may ask for location only after the
 * click, which Playwright cannot see as a prompt, so the page counts `getCurrentPosition` calls instead.
 * Onboarding in Madrid uses the stubbed place search; the device position is Kraków.
 */

// Four decimals in, two out: about 1 km.
const KRAKOW = { latitude: 50.0614, longitude: 19.9366 };
const NEW_SITE_FORM = 'form[action="/api/gear/sites"]';
const EDIT_SITE_FORM = 'form[action^="/api/gear/sites/"]';

test.use({ geolocation: KRAKOW, permissions: ["geolocation"] });

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

/** Wraps `navigator.geolocation.getCurrentPosition` on every later page load to count its calls. */
async function countGeolocationCalls(page: Page) {
  await page.addInitScript(() => {
    const counter = globalThis as unknown as { geolocationCalls: number };
    counter.geolocationCalls = 0;
    const geolocation = navigator.geolocation;
    const original = geolocation.getCurrentPosition.bind(geolocation);
    geolocation.getCurrentPosition = (...args) => {
      counter.geolocationCalls += 1;
      original(...args);
    };
  });
}

function geolocationCalls(page: Page) {
  return page.evaluate(() => (globalThis as unknown as { geolocationCalls: number }).geolocationCalls);
}

test("a new site asks for the location only on click and saves it rounded", async ({ page }) => {
  await onboardInMadrid(page, "e2e-site-location");
  await countGeolocationCalls(page);

  await page.goto("/gear/sites/new");
  await waitForHydration(page, NEW_SITE_FORM);
  const form = page.locator(NEW_SITE_FORM);
  expect(await geolocationCalls(page)).toBe(0);

  await form.getByRole("button", { name: en.location.useLocation }).click();

  await expect(form.locator("#latitudeDeg")).toHaveValue("50.06");
  await expect(form.locator("#longitudeDeg")).toHaveValue("19.94");
  await expect(form.getByText(en.location.usingDevice)).toBeVisible();
  expect(await geolocationCalls(page)).toBe(1);

  // A device pick fills neither the name nor the sky class.
  await form.locator("#name").fill("Kraków balcony");
  await form.locator("#bortle").selectOption("7");
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/gear\?saved=site$/);
  await expect(page.getByText("Kraków balcony")).toBeVisible();
});

test("editing a site: a picked location can be undone back to the saved one", async ({ page }) => {
  await onboardInMadrid(page, "e2e-site-location");

  await page.goto("/gear");
  await page.locator('a[href^="/gear/sites/"]:not([href="/gear/sites/new"])').first().click();
  await waitForHydration(page, EDIT_SITE_FORM);
  const form = page.locator(EDIT_SITE_FORM);
  await expect(form.locator("#latitudeDeg")).toHaveValue("40.42");

  await form.getByRole("button", { name: en.location.useLocation }).click();
  await expect(form.locator("#latitudeDeg")).toHaveValue("50.06");
  const previous = form.getByText(en.siteForm.previousLocation({ latitude: "40.42", longitude: "-3.7" }));
  await expect(previous).toBeVisible();

  await form.getByRole("button", { name: en.siteForm.undoLocation }).click();

  await expect(form.locator("#latitudeDeg")).toHaveValue("40.42");
  await expect(form.locator("#longitudeDeg")).toHaveValue("-3.7");
  await expect(previous).toBeHidden();
  await expect(form.locator("#latitudeDeg")).toBeFocused();
});
