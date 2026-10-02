import { expect, test } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * The Moon on Tonight, end to end (M-2 S-02): "Mark observed" on the Moon card saves it through the log form,
 * Tonight confirms it and tags the card as seen, and the log lists it as "Moon". Same setup as
 * `planets-on-tonight.spec.ts`: a production preview on local Supabase with FORECAST_BASE_URL pointing at
 * `tests/e2e/forecast-fixture.mjs` (an all-clear sky), and place search stubbed with Madrid.
 *
 * The clock is real, so on roughly half of all nights the Moon is not up between dusk and dawn (or is too thin a
 * crescent) and the spec skips. It proves the logging flow when it runs; what the card says on a given night, and
 * the bright-Moon line, are pinned on fixed nights by the build's unit tests.
 */

const LOG_FORM = 'form[action="/api/log"]';

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("marking the Moon observed from Tonight saves it, tags the card and lists it in the log", async ({ page }) => {
  await onboardInMadrid(page, "e2e-moon");

  // Tonight's content is a server island fetched after the page loads: wait for it (the verdict card always
  // renders) before deciding the Moon is absent, or the count below would always be 0.
  await expect(page.locator('section[aria-labelledby="verdict-heading"]')).toBeVisible();
  const section = page.locator('section[aria-labelledby="solar-system-heading"]');
  const moonCard = section.locator('article[aria-labelledby="moon-heading"]');
  if ((await moonCard.count()) === 0) {
    test.skip(true, "the Moon is not up in Madrid between dusk and dawn tonight");
  }
  const name = en.targets.moon;
  await expect(moonCard.getByRole("heading", { level: 3 })).toHaveText(name);

  await moonCard.getByRole("link", { name: en.tonight.moon.markObserved({ name }) }).click();

  // The form arrives prefilled with the Moon's target key and tonight's night, site and telescope.
  await expect(page).toHaveURL(/\/log\/new\?object=moon&night=\d{4}-\d{2}-\d{2}&site=/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(en.log.title({ object: name }));
  await waitForHydration(page, LOG_FORM);
  const form = page.locator(LOG_FORM);
  // The radios are visually hidden inside their labels; click the label, as a user does.
  await form.locator("label").filter({ hasText: /^4$/ }).click();
  await form.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/tonight\?logged=moon$/);
  await expect(page.getByRole("status").filter({ hasText: en.tonight.logged({ object: name }) })).toBeVisible();
  // The log never reorders the Moon: the card stays and carries the "seen" tag.
  await expect(moonCard).toContainText(en.tonight.object.seen.one({ count: "1", date: "" }));

  await page.getByRole("link", { name: en.nav.log }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(page.locator('main a[href^="/log/"]').filter({ hasText: name })).toBeVisible();
});
