import { expect, test } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * The Moon as a target, end to end (M-2 S-02, moved into the Moon card by moonlight-and-the-verdict and onto the Moon
 * page by tonight-dashboard): "Mark observed" in the Moon card saves it through the log form, the save returns to the
 * Moon page, which confirms it and tags the card as seen, and the log lists it as "Moon". Same setup as `planets-on-tonight.spec.ts`: a production preview on local Supabase with
 * FORECAST_BASE_URL pointing at `tests/e2e/forecast-fixture.mjs` (an all-clear sky), and place search stubbed with
 * Madrid.
 *
 * The Moon card shows every night, but the clock is real, so on roughly half of all nights the Moon is not a target
 * (not up between dusk and dawn, or too thin a crescent) and the spec skips. It proves the logging flow when it runs;
 * what the card says on a given night, faint-objects line included, is pinned on fixed nights by the build's unit
 * tests.
 */

const LOG_FORM = 'form[action="/api/log"]';

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("marking the Moon observed on the Moon page saves it, tags the card and lists it in the log", async ({ page }) => {
  await onboardInMadrid(page, "e2e-moon");
  await page.goto("/tonight/moon");

  // The page's content is a server island fetched after the page loads: wait for the card (it always renders in
  // Madrid) before deciding the Moon is no target, or the count below would always be 0.
  const moonCard = page.locator('section[aria-labelledby="moon-heading"]');
  await expect(moonCard.getByRole("heading", { level: 2 })).toBeVisible();
  const name = en.targets.moon;
  const markObserved = moonCard.getByRole("link", { name: en.tonight.moon.markObserved({ name }) });
  if ((await markObserved.count()) === 0) {
    test.skip(true, "the Moon is not a target in Madrid between dusk and dawn tonight");
  }

  await markObserved.click();

  // The form arrives prefilled with the Moon's target key and tonight's night, site and telescope.
  await expect(page).toHaveURL(/\/log\/new\?object=moon&night=\d{4}-\d{2}-\d{2}&site=.*&from=moon$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(en.log.title({ object: name }));
  await waitForHydration(page, LOG_FORM);
  const form = page.locator(LOG_FORM);
  // The radios are visually hidden inside their labels; click the label, as a user does.
  await form.locator("label").filter({ hasText: /^4$/ }).click();
  await form.locator('button[type="submit"]').click();

  // The save returns to the page it came from (`from=moon`).
  await expect(page).toHaveURL(/\/tonight\/moon\?logged=moon$/);
  await expect(page.getByRole("status").filter({ hasText: en.tonight.logged({ object: name }) })).toBeVisible();
  // The log never reorders the Moon: the card stays and carries the "seen" tag.
  await expect(moonCard).toContainText(en.tonight.object.seen.one({ count: "1", date: "" }));

  await page.getByRole("link", { name: en.nav.log }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(page.locator('main a[href^="/log/"]').filter({ hasText: name })).toBeVisible();
});
