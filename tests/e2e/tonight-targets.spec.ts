import { expect, test } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * The Targets page (tonight-all-objects; /tonight/targets since tonight-dashboard): every object that cleared the bar
 * for the setup picked on Tonight, as ruled rows by rank or by best time, each opening into the same details as
 * Tonight's card, "Mark observed" included, which returns here. The retired /tonight/all redirects here for good.
 * Runs on the all-clear forecast fixture, so the ranking always exists and lists more than Tonight's five.
 */

const LOG_FORM = 'form[action="/api/log"]';

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("the Targets page lists every cleared object by best time or rank, and logs from a row", async ({ page }) => {
  await onboardInMadrid(page, "e2e-targets");

  // An old /tonight/all link moves for good, keeping a valid order.
  const response = await page.request.get("/tonight/all?sort=time", { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toMatch(/\/tonight\/targets\?sort=time$/);
  await page.goto("/tonight/all?sort=time");
  await expect(page).toHaveURL(/\/tonight\/targets\?sort=time$/);

  // The list is a server island fetched after the page loads: its heading waits for it.
  const heading = page.locator("#targets-heading");
  await expect(heading).toBeVisible();
  const count = Number(/(\d+)/.exec(await heading.innerText())?.[1]);
  expect(count).toBeGreaterThan(5);
  await expect(heading).toHaveText(en.tonight.all.heading.other({ count: String(count) }));
  const rows = page.locator("li[data-best-at]");
  await expect(rows).toHaveCount(count);

  const order = page.getByRole("navigation", { name: en.tonight.all.sortLabel });
  await expect(order.getByRole("link", { name: en.tonight.all.byTime })).toHaveAttribute("aria-current", "page");
  const bestAt = await rows.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-best-at"))));
  expect(bestAt).toEqual([...bestAt].sort((a, b) => a - b));

  await order.getByRole("link", { name: en.tonight.all.byRank }).click();
  await expect(page).toHaveURL(/\/tonight\/targets\?sort=rank$/);
  await expect(rows).toHaveCount(count);
  await expect(order.getByRole("link", { name: en.tonight.all.byRank })).toHaveAttribute("aria-current", "page");
  // Each summary opens with its rank ("1."), so by rank they read 1, 2, 3, …
  const ranks = await rows.evaluateAll((els) =>
    els.map((e) => Number(/(\d+)\./.exec(e.querySelector("summary")?.textContent ?? "")?.[1])),
  );
  expect(ranks).toEqual(Array.from({ length: count }, (_, i) => i + 1));

  // "Mark observed" inside a row: the form returns to this page (`from=targets`).
  const third = rows.nth(2);
  // The log link carries the target key ("M31"), the same as the row's `data-object`.
  const object = await third.getAttribute("data-object");
  if (!object) throw new Error("the third row has no data-object");
  await third.locator("summary").click();
  await third.getByRole("link", { name: new RegExp(en.tonight.object.markObserved) }).click();
  await expect(page).toHaveURL(new RegExp(`/log/new\\?object=${object}&.*&from=targets$`));
  await waitForHydration(page, LOG_FORM);
  const form = page.locator(LOG_FORM);
  // The radios are visually hidden inside their labels; click the label, as a user does.
  await form.locator("label").filter({ hasText: /^4$/ }).click();
  await form.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(new RegExp(`/tonight/targets\\?logged=${object}$`));
  await expect(page.getByRole("status").filter({ hasText: en.tonight.logged({ object }) })).toBeVisible();
});

test("an old /tonight/all#washed-out bookmark lands on the washed-out group on Targets", async ({ page }) => {
  await onboardInMadrid(page, "e2e-targets-washedout");

  // The redirect's Location carries no fragment; the browser keeps the request's own.
  await page.goto("/tonight/all#washed-out");
  await expect(page).toHaveURL(/\/tonight\/targets#washed-out$/);
  // Wait for the island (the list's heading) before deciding whether there is a group to land on.
  await expect(page.locator("#targets-heading")).toBeVisible();
  // Whether tonight's real Moon washes anything out depends on the date the suite runs.
  test.skip((await page.locator("#washed-out").count()) === 0, "tonight's Moon washes out no object");

  await expect(page.locator("[data-washed-out-object]").first()).toBeVisible();
  // The group arrives with the server island, after the fragment was first resolved; the page scrolls to it then.
  await expect(page.locator("#washed-out")).toBeInViewport();
});
