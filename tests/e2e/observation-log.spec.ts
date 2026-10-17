import { expect } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { dismissCelebrationIfOpen, onboardInMadrid, test, waitForHydration } from "./helpers";

/*
 * The observation log's entry form, end to end (S-06, FR-016 / FR-018): an object outside the catalogue is turned away,
 * and a Caldwell object is found in the manual picker and shows in the log. Marking an object observed from the Targets
 * page (and the Moon and a planet) is the journey in `mark-observed.spec.ts`. Same setup as `onboarding.spec.ts`: a
 * production preview on local Supabase with FORECAST_BASE_URL pointing at `tests/e2e/forecast-fixture.mjs` (an
 * all-clear sky), and place search stubbed with Madrid.
 */

const LOG_FORM = 'form[action="/api/log"]';

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
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
  await dismissCelebrationIfOpen(page);
  await expect(page.locator('main a[href^="/log/"]').filter({ hasText: "NGC 7000" })).toContainText(
    en.log.list.rated({ rating: "4" }),
  );
});
