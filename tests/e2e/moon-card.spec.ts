import { expect, test } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * The Moon card's time slider, end to end (moonlight-and-the-verdict): moving the slider redraws the Moon for another
 * moment of tonight's window, the arrow keys step it, and "Now" brings back the page-load moment. Same setup as
 * `moon-as-target.spec.ts`: a production preview on local Supabase with FORECAST_BASE_URL pointing at
 * `tests/e2e/forecast-fixture.mjs`, and place search stubbed with Madrid.
 *
 * The clock is real, so the page-load moment can sit anywhere in the window: the spec reads where it starts and moves
 * to the far end from there. Madrid always has a civil window, so the slider normally shows; it skips if it doesn't.
 * What the disc looks like for a given state is pinned by the Moon-disc geometry tests.
 */

const MOON_CARD = 'section[aria-labelledby="moon-heading"]';

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("the Moon card's slider redraws the Moon across the window and Now restores it", async ({ page }) => {
  await onboardInMadrid(page, "e2e-moon-card");

  // Tonight's content is a server island fetched after the page loads: wait for it before looking for the slider.
  await expect(page.locator('section[aria-labelledby="verdict-heading"]')).toBeVisible();
  const card = page.locator(MOON_CARD);
  await expect(card.getByRole("heading", { level: 2, name: en.tonight.moon.card.kicker })).toBeVisible();
  const slider = card.getByRole("slider", { name: en.tonight.moon.card.slider });
  if ((await slider.count()) === 0) {
    test.skip(true, "the Moon card has fewer than two states tonight, so there is no slider");
  }
  await waitForHydration(page, `${MOON_CARD} input[type="range"]`);

  const time = card.locator("[data-moon-time]");
  const disc = card.locator("[data-moon-disc]");
  const max = Number(await slider.getAttribute("max"));
  const initialValue = await slider.inputValue();
  const initialTime = (await time.textContent()) ?? "";
  const initialLabel = (await disc.getAttribute("aria-label")) ?? "";
  expect(initialTime).not.toBe("");
  await expect(slider).toHaveAttribute("aria-valuetext", initialTime);
  await expect(disc).toHaveAttribute("aria-label", new RegExp(`\\b${initialTime}\\b`));

  // To the last step; when the page loaded at the window's end already, to the first instead.
  const atEnd = Number(initialValue) === max;
  await slider.focus();
  await slider.press(atEnd ? "Home" : "End");
  await expect(slider).toHaveValue(atEnd ? "0" : String(max));
  await expect(time).not.toHaveText(initialTime);
  await expect(disc).not.toHaveAttribute("aria-label", initialLabel);
  const movedTime = (await time.textContent()) ?? "";
  await expect(slider).toHaveAttribute("aria-valuetext", movedTime);
  await expect(disc).toHaveAttribute("aria-label", new RegExp(`\\b${movedTime}\\b`));

  // An arrow key steps one state (10 minutes) back towards the middle.
  await slider.press(atEnd ? "ArrowRight" : "ArrowLeft");
  await expect(slider).toHaveValue(atEnd ? "1" : String(max - 1));
  await expect(time).not.toHaveText(movedTime);

  await card.getByRole("button", { name: en.tonight.moon.card.now }).click();
  await expect(slider).toHaveValue(initialValue);
  await expect(time).toHaveText(initialTime);
  await expect(disc).toHaveAttribute("aria-label", initialLabel);
});
