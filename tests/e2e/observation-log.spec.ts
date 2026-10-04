import { expect, test } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * Mark observed from the Targets page, end to end (S-06, FR-016 / FR-018; the Targets page since tonight-dashboard),
 * from the same setup as `onboarding.spec.ts`: a production preview on local Supabase with FORECAST_BASE_URL pointing
 * at `tests/e2e/forecast-fixture.mjs` (an all-clear sky), and place search stubbed with Madrid.
 *
 * The clock is real, so which objects rank varies by date. The spec therefore never asserts a position: the order
 * rule is pinned by the engine's unit tests.
 */

const LOG_FORM = 'form[action="/api/log"]';

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("marking a target observed on the Targets page saves it and tags its row there", async ({ page }) => {
  await onboardInMadrid(page, "e2e-log");
  await page.goto("/tonight/targets");

  // The list is a server island fetched after the page loads: the first of the best objects waits for it. Those are
  // shown in full, so "Mark observed" is right there.
  const firstRow = page.locator("li[data-object]").first();
  await expect(firstRow).toBeVisible();
  const id = await firstRow.getAttribute("data-object");
  if (!id || !/^M\d{1,3}$/.test(id)) throw new Error(`no Messier id on the first row: ${id}`);

  await firstRow.getByRole("link", { name: new RegExp(en.tonight.object.markObserved) }).click();

  // The form arrives prefilled from the row (the object by its target key, "M31"), with the rating left to the user,
  // and returns to the Targets page (`from=targets`).
  await expect(page).toHaveURL(new RegExp(`/log/new\\?object=${id}&night=\\d{4}-\\d{2}-\\d{2}&site=.*&from=targets$`));
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

  await expect(page).toHaveURL(new RegExp(`/tonight/targets\\?logged=${id}$`));
  await expect(page.getByRole("status").filter({ hasText: en.tonight.logged({ object: id }) })).toBeVisible();

  // Rated 4, the object moves down the list (maybe behind "Show the other …") but still cleared the bar, so its row
  // is there with the "seen" tag (the tag's wording up to the date, taken from the catalogue).
  const loggedRow = page.locator(`li[data-object="${id}"]`);
  await expect(loggedRow).toContainText(en.tonight.object.seen.one({ count: "1", date: "" }));
});

test("the log form turns away an object outside the Messier catalogue", async ({ page }) => {
  await onboardInMadrid(page, "e2e-log");

  await page.goto("/log/new?object=111");

  await expect(page.getByText(en.log.objectNotFound)).toBeVisible();
  await expect(page.locator(LOG_FORM)).toHaveCount(0);
});
