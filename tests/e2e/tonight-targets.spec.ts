import { expect } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { dismissCelebrationIfOpen, onboardInMadrid, test, waitForHydration } from "./helpers";

/*
 * The Targets page (tonight-all-objects; /tonight/targets since tonight-dashboard): tonight's best objects in full,
 * then a button that opens the rest of what cleared the bar as ruled rows, by rank or by best time, each opening into
 * the same details, "Mark observed" included, which returns here. The retired /tonight/all redirects here for good.
 * Runs on the all-clear forecast fixture, so the ranking always exists and clears more than the best five.
 */

const LOG_FORM = 'form[action="/api/log"]';
const BEST = 5;

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("Targets shows the best five, opens the rest by best time or rank, and logs from a row", async ({ page }) => {
  await onboardInMadrid(page, "e2e-targets");

  // An old /tonight/all link moves for good, keeping a valid order.
  const response = await page.request.get("/tonight/all?sort=time", { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toMatch(/\/tonight\/targets\?sort=time$/);

  // Without an order the rest of the list waits behind its button; the best five are shown in full.
  await page.goto("/tonight/targets");
  const best = page.locator('section[aria-labelledby="targets-heading"] > ol > li[data-object]');
  await expect(best).toHaveCount(BEST);
  await expect(page.locator("#targets-heading")).toHaveText(en.tonight.summary.targets);
  const more = page.locator("details#more");
  await expect(more).not.toHaveAttribute("open");
  const button = more.locator(":scope > summary");
  const rest = Number(/(\d+)/.exec(await button.innerText())?.[1]);
  expect(rest).toBeGreaterThan(0);
  await expect(button).toHaveText(en.tonight.pages.showRest.other({ count: String(rest) }));
  await button.click();
  await expect(more).toHaveAttribute("open");
  const rows = more.locator("li[data-best-at]");
  await expect(rows).toHaveCount(rest);

  // An order is a link inside the list, so the page comes back with the list open, in that order.
  const order = page.getByRole("navigation", { name: en.tonight.all.sortLabel });
  await order.getByRole("link", { name: en.tonight.all.byTime }).click();
  await expect(page).toHaveURL(/\/tonight\/targets\?sort=time#more$/);
  await expect(more).toHaveAttribute("open");
  await expect(rows).toHaveCount(rest);
  await expect(order.getByRole("link", { name: en.tonight.all.byTime })).toHaveAttribute("aria-current", "page");
  const bestAt = await rows.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-best-at"))));
  expect(bestAt).toEqual([...bestAt].sort((a, b) => a - b));

  await order.getByRole("link", { name: en.tonight.all.byRank }).click();
  await expect(page).toHaveURL(/\/tonight\/targets\?sort=rank#more$/);
  await expect(order.getByRole("link", { name: en.tonight.all.byRank })).toHaveAttribute("aria-current", "page");
  // Each summary opens with its rank ("6."): the rest picks up after the best five.
  const ranks = await rows.evaluateAll((els) =>
    els.map((e) => Number(/(\d+)\./.exec(e.querySelector("summary")?.textContent ?? "")?.[1])),
  );
  expect(ranks).toEqual(Array.from({ length: rest }, (_, i) => BEST + i + 1));

  // "Mark observed" inside a row: the form returns to this page (`from=targets`).
  const third = rows.nth(2);
  // The log link carries the target key ("M31", "NGC7000"), the same as the row's `data-object`; the row shows the
  // label ("M31", "NGC 7000"), which is what the notice names. Any season's rows can be Caldwell objects.
  const object = await third.getAttribute("data-object");
  if (!object) throw new Error("the third row has no data-object");
  const label = await third.getAttribute("data-label");
  if (!label) throw new Error("the third row has no data-label");
  await third.locator("summary").click();
  await third.getByRole("link", { name: new RegExp(en.tonight.object.markObserved) }).click();
  await expect(page).toHaveURL(new RegExp(`/log/new\\?object=${object}&.*&from=targets$`));
  await waitForHydration(page, LOG_FORM);
  const form = page.locator(LOG_FORM);
  // The radios are visually hidden inside their labels; click the label, as a user does.
  await form.locator("label").filter({ hasText: /^4$/ }).click();
  await form.locator('button[type="submit"]').click();

  await expect(page.getByRole("status").filter({ hasText: en.tonight.logged({ object: label }) })).toBeVisible();
  await expect(page).toHaveURL(/\/tonight\/targets$/);
  await dismissCelebrationIfOpen(page);
  // The row just logged is on screen: the page opens the rest of the list for it and scrolls it into view.
  await expect(page.locator(`[data-object="${object}"]`)).toBeInViewport();
});
