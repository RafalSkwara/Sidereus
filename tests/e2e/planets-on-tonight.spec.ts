import { expect, test } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * Planets on Tonight, end to end (M-2 S-01): the "Planets tonight" section shows, "Mark observed" on a planet saves
 * it through the log form, and the log lists it by name. Same setup as `observation-log.spec.ts`: a production
 * preview on local Supabase with FORECAST_BASE_URL pointing at `tests/e2e/forecast-fixture.mjs` (an all-clear sky,
 * so the planet window is go), and place search stubbed with Madrid.
 *
 * The clock is real, so which planets are up varies by date: the spec takes the first card and never names a
 * planet. Which planets qualify and in what order is pinned by the engine's and the build's unit tests. The section
 * lists planets only (the Moon has its own card at the top since moonlight-and-the-verdict).
 */

const LOG_FORM = 'form[action="/api/log"]';

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("marking a planet observed from Tonight saves it and the log lists it by name", async ({ page }) => {
  await onboardInMadrid(page, "e2e-planets");

  const section = page.locator('section[aria-labelledby="planets-heading"]');
  await expect(section.getByRole("heading", { level: 2 })).toHaveText(en.tonight.planets.heading);
  const planetList = section.getByRole("list", { name: en.tonight.planets.listLabel });
  const cards = planetList.getByRole("listitem");
  if ((await cards.count()) === 0) {
    // Some nights no planet clears the minimum altitude: the section says so, and there is no planet to mark.
    await expect(section).toContainText(en.tonight.planets.none);
    test.skip(true, "no planet is up in Madrid tonight");
  }

  const firstCard = cards.first();
  const name = ((await firstCard.getByRole("heading", { level: 3 }).textContent()) ?? "").trim();
  const markObserved = firstCard.getByRole("link", { name: en.tonight.object.markObserved });
  const key = new URL((await markObserved.getAttribute("href")) ?? "", "http://localhost").searchParams.get("object");
  const planetNames: Record<string, string> = en.targets.planet;
  if (!key || planetNames[key] !== name) throw new Error(`the first planet card links "${key}" but is named "${name}"`);

  await markObserved.click();

  // The form arrives prefilled with the planet's target key and tonight's night, site and telescope.
  await expect(page).toHaveURL(new RegExp(`/log/new\\?object=${key}&night=\\d{4}-\\d{2}-\\d{2}&site=`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText(en.log.title({ object: name }));
  await waitForHydration(page, LOG_FORM);
  const form = page.locator(LOG_FORM);
  // The radios are visually hidden inside their labels; click the label, as a user does.
  await form.locator("label").filter({ hasText: /^4$/ }).click();
  await form.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(new RegExp(`/tonight\\?logged=${key}$`));
  await expect(page.getByRole("status").filter({ hasText: en.tonight.logged({ object: name }) })).toBeVisible();

  // Planets are never pushed down by the log, so the card stays and carries the "seen" tag.
  const loggedCard = planetList.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(loggedCard).toContainText(en.tonight.object.seen.one({ count: "1", date: "" }));

  await page.getByRole("link", { name: en.nav.log }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(page.locator('main a[href^="/log/"]').filter({ hasText: name })).toBeVisible();
});
