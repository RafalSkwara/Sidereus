import { expect, test } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * Mark observed from the ranking, end to end (S-06, FR-016 / FR-018), from the same setup as
 * `onboarding.spec.ts`: a production preview on local Supabase with FORECAST_BASE_URL pointing at
 * `tests/e2e/forecast-fixture.mjs` (an all-clear sky), and place search stubbed with Madrid.
 *
 * The clock is real, so which objects rank (and whether a logged one stays in the top five) varies by date.
 * The spec therefore never asserts a position: the order rule is pinned by the engine's unit tests.
 */

const LOG_FORM = 'form[action="/api/log"]';

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("marking a ranked object observed saves it and tags it on Tonight", async ({ page }) => {
  await onboardInMadrid(page, "e2e-log");

  const ranking = page.locator('section[aria-labelledby="ranking-heading"]');
  const firstCard = ranking.locator("ol > li").first();
  await expect(firstCard).toBeVisible();
  const heading = (await firstCard.getByRole("heading").textContent()) ?? "";
  const id = /\bM\d{1,3}\b/.exec(heading)?.[0];
  if (!id) throw new Error(`no Messier id in the first card's heading: ${heading}`);

  await firstCard.getByRole("link", { name: en.tonight.object.markObserved }).click();

  // The form arrives prefilled from the ranking (the object by its target key, "M31"), with the rating left to the user.
  await expect(page).toHaveURL(new RegExp(`/log/new\\?object=${id}&night=\\d{4}-\\d{2}-\\d{2}&site=`));
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

  await expect(page).toHaveURL(new RegExp(`/tonight\\?logged=${id}$`));
  await expect(page.getByRole("status").filter({ hasText: en.tonight.logged({ object: id }) })).toBeVisible();

  // Rated 4, the object is pushed down: it either left the top five or carries the "seen" tag.
  await expect(ranking.locator("ol > li").first()).toBeVisible();
  const loggedCard = ranking.locator("ol > li").filter({
    has: page.getByRole("heading", { name: new RegExp(`\\b${id}\\b`) }),
  });
  if ((await loggedCard.count()) > 0) {
    // The tag's wording up to the date, taken from the catalogue.
    await expect(loggedCard).toContainText(en.tonight.object.seen.one({ count: "1", date: "" }));
  }
});

test("the log form turns away an object outside the Messier catalogue", async ({ page }) => {
  await onboardInMadrid(page, "e2e-log");

  await page.goto("/log/new?object=111");

  await expect(page.getByText(en.log.objectNotFound)).toBeVisible();
  await expect(page.locator(LOG_FORM)).toHaveCount(0);
});
