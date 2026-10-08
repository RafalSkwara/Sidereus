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
  // The real clock decides the ranking, so the first row can be a Messier or a Caldwell object: the key ("M31",
  // "NGC7000") is the row's `data-object` and the link's `object`, the label ("M31", "NGC 7000") is what pages name it by.
  const id = await firstRow.getAttribute("data-object");
  if (!id || !/^(M\d{1,3}|(NGC|IC)\d{1,4})$/.test(id)) throw new Error(`no catalogue key on the first row: ${id}`);
  const label = await firstRow.getAttribute("data-label");
  if (!label) throw new Error("the first row has no data-label");

  await firstRow.getByRole("link", { name: new RegExp(en.tonight.object.markObserved) }).click();

  // The form arrives prefilled from the row (the object by its target key, "M31" or "NGC7000"), with the rating left to the user,
  // and returns to the Targets page (`from=targets`).
  await expect(page).toHaveURL(new RegExp(`/log/new\\?object=${id}&night=\\d{4}-\\d{2}-\\d{2}&site=.*&from=targets$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText(en.log.title({ object: label }));
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

  await expect(page.getByRole("status").filter({ hasText: en.tonight.logged({ object: label }) })).toBeVisible();
  await expect(page).toHaveURL(/\/tonight\/targets$/);

  // Rated 4, the object moves down the list (maybe behind "Show the other …") but still cleared the bar, so its row
  // is there with the "seen" tag (the tag's wording up to the date, taken from the catalogue).
  const loggedRow = page.locator(`li[data-object="${id}"]`);
  await expect(loggedRow).toContainText(en.tonight.object.seen.one({ count: "1", date: "" }));
});

test("the log form turns away an object outside the catalogue", async ({ page }) => {
  await onboardInMadrid(page, "e2e-log");

  // 111 is past M110; NGC1 is a well-formed key the catalogue does not list.
  for (const object of ["111", "NGC1"]) {
    await page.goto(`/log/new?object=${object}`);

    await expect(page.getByText(en.log.objectNotFound)).toBeVisible();
    await expect(page.locator(LOG_FORM)).toHaveCount(0);
  }
});

test("a Caldwell object is found in the manual picker by its number and shows in the log", async ({ page }) => {
  await onboardInMadrid(page, "e2e-log-caldwell");

  await page.goto("/log/new?from=log");
  await waitForHydration(page, LOG_FORM);
  const form = page.locator(LOG_FORM);
  const picker = form.getByRole("combobox", { name: en.log.picker.label });
  await picker.fill("c 20");
  await expect(form.getByRole("option").first()).toContainText("NGC 7000");
  await picker.press("Enter");
  await expect(picker).toHaveValue(/^NGC 7000 · /);
  await form.locator("label").filter({ hasText: /^4$/ }).click();
  await form.locator('button[type="submit"]').click();

  await expect(page.getByRole("status")).toHaveText(en.log.list.saved({ object: "NGC 7000" }));
  await expect(page).toHaveURL(/\/log$/);
  await expect(page.locator('main a[href^="/log/"]').filter({ hasText: "NGC 7000" })).toContainText(
    en.log.list.rated({ rating: "4" }),
  );
});
