import { expect, test } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { onboardInMadrid } from "./helpers";

/*
 * All tonight's objects (tonight-all-objects): when more objects cleared the bar than Tonight lists, Tonight links
 * to /tonight/all, which lists every one of them for the same setup as compact rows, by rank or by best time, and
 * each row opens into the same details, "Mark observed" included. Runs on the all-clear forecast fixture.
 */

test("Tonight links to every cleared object, which can be ordered by best time and logged", async ({ page }) => {
  await onboardInMadrid(page, "allobjects");

  const ranking = page.locator('section[aria-labelledby="ranking-heading"]');
  await expect(ranking.locator("ol > li").first()).toBeVisible();
  const count = Number(/(\d+)/.exec(await page.locator("#ranking-heading").innerText())?.[1]);
  expect(count).toBeGreaterThan(5);
  const topFive = await ranking
    .locator("ol > li h3")
    .evaluateAll((els) => els.map((e) => /M\d+/.exec(e.textContent)?.[0]));

  await expect(ranking.getByRole("link", { name: en.tonight.all.seeAll, exact: true })).toBeVisible();
  await ranking.getByRole("link", { name: en.tonight.all.seeAllCount.other({ count: String(count) }) }).click();
  await expect(page).toHaveURL(/\/tonight\/all$/);

  const rows = page.locator("li[data-best-at]");
  await expect(page.locator("h1")).toHaveText(en.tonight.all.heading.other({ count: String(count) }));
  await expect(rows).toHaveCount(count);
  const firstFive = await rows.evaluateAll((els) => els.slice(0, 5).map((e) => e.getAttribute("data-object")));
  expect(firstFive).toEqual(topFive);

  await page.getByRole("link", { name: en.tonight.all.byTime }).click();
  await expect(page).toHaveURL(/\/tonight\/all\?sort=time$/);
  await expect(page.getByRole("link", { name: en.tonight.all.byTime })).toHaveAttribute("aria-current", "page");
  const bestAt = await page
    .locator("li[data-best-at]")
    .evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-best-at"))));
  expect(bestAt).toHaveLength(count);
  expect(bestAt).toEqual([...bestAt].sort((a, b) => a - b));

  const third = page.locator("li[data-best-at]").nth(2);
  // The log link carries the target key ("M31"), the same as the row's `data-object`.
  const object = await third.getAttribute("data-object");
  await third.locator("summary").click();
  await third.getByRole("link", { name: new RegExp(en.tonight.object.markObserved) }).click();
  await expect(page).toHaveURL(new RegExp(`/log/new\\?object=${object}&`));
});
