import { expect, test, type Locator, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";
import type { MilestoneKey } from "@/lib/progress/milestones";
import { createFormatter } from "@/lib/tonight/format";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * Observing milestones (M-3 S-06, FR-041, US-06): the record half. A milestone is stored at save, never for an entry
 * rated 1-2, and stays listed on `/log/progress` after the entry that reached it was edited away or deleted. One
 * fresh Madrid user on the all-clear forecast fixture, so nothing depends on test order. The copy is read from the
 * catalogue and the dates go through the same formatter the page uses.
 */

const copy = en.progress.milestones;
const LOG_FORM = 'form[action="/api/log"]';
const EDIT_FORM = 'form[action^="/api/log/"]:not([action$="/delete"])';
const DELETE_FORM = 'form[action$="/delete"]';
const format = createFormatter("en");

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

async function rate(form: Locator, rating: number) {
  // The radios are visually hidden inside their labels; click the label, as a user does.
  await form
    .locator("label")
    .filter({ hasText: new RegExp(`^${rating}$`) })
    .click();
}

/** Fills the new-entry form for `url`, rates it and saves; returns the night the form proposed and went on to save. */
async function logEntry(page: Page, url: string, rating: number, returnsTo: RegExp): Promise<string> {
  await page.goto(url);
  await waitForHydration(page, LOG_FORM);
  const form = page.locator(LOG_FORM);
  const night = await form.locator("#night").inputValue();
  expect(night).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await rate(form, rating);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(returnsTo);
  return night;
}

/** Opens the log entry for `id` (the entry's link in the log) and waits for its edit form. */
async function openEntry(page: Page, id: string): Promise<Locator> {
  await page.goto("/log");
  await page.locator('main a[href^="/log/"]').filter({ hasText: id }).click();
  await expect(page).toHaveURL(/\/log\/[0-9a-f-]{36}$/);
  await waitForHydration(page, EDIT_FORM);
  return page.locator(EDIT_FORM);
}

const row = (page: Page, key: MilestoneKey) => page.locator(`[data-milestone="${key}"]`);

/** The row is reached, on `night`, with its name and a check. */
async function expectReached(page: Page, key: MilestoneKey, night: string) {
  const milestone = row(page, key);
  await expect(milestone).toHaveCount(1);
  await expect(milestone).toHaveAttribute("data-reached", "");
  await expect(milestone).toContainText(copy.name[key]);
  await expect(milestone).toContainText(copy.reachedOn({ date: format.formatShortDate(night) }));
}

/** The row is still ahead: no `data-reached`, and `status` (Not yet, or "x / N") as its note. */
async function expectAhead(page: Page, key: MilestoneKey, status: string) {
  const milestone = row(page, key);
  await expect(milestone).toHaveCount(1);
  await expect(milestone).not.toHaveAttribute("data-reached", /.*/);
  await expect(milestone).toContainText(copy.name[key]);
  await expect(milestone).toContainText(status);
}

test("records a milestone once, at save, and keeps it listed", async ({ page }) => {
  test.setTimeout(180_000);
  await onboardInMadrid(page, "e2e-milestones");

  // 1. M31 rated 2 reaches nothing: the first galaxy is still ahead.
  await logEntry(page, "/log/new?object=M31&from=log", 2, /\/log(\?|$)/);
  await page.goto("/log/progress");
  await expect(page.locator("#progress-milestones-heading")).toHaveText(copy.title);
  await expect(page.locator("[data-milestone]")).toHaveCount(11);
  await expectAhead(page, "first-galaxy", copy.notYet);

  // 2. Edited to 4, the entry reaches it, on the entry's own night.
  let form = await openEntry(page, "M31");
  const galaxyNight = await form.locator("#night").inputValue();
  await expect(form.getByRole("radio", { name: "2", exact: true })).toBeChecked();
  await rate(form, 4);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/log(\?|$)/);
  await page.goto("/log/progress");
  await expectReached(page, "first-galaxy", galaxyNight);

  // 3. Jupiter, logged from the planets page's form (straight to the form: it does not depend on Jupiter being up
  // tonight), reaches the first planet. It is no Messier object, so the Messier count stays at the galaxy alone.
  const jupiterNight = await logEntry(page, "/log/new?object=jupiter&from=planets", 3, /\/tonight\/planets(\?|$)/);
  await page.goto("/log/progress");
  await expectReached(page, "first-planet", jupiterNight);
  await expectAhead(page, "messier-10", copy.progress({ seen: "1", total: "10" }));

  // 4. The M31 entry becomes M13, still rated 4: the globular is reached, and the first galaxy stays, on its stored
  // night, though no entry holds a galaxy any more.
  form = await openEntry(page, "M31");
  const picker = form.getByRole("combobox", { name: en.log.picker.label });
  await picker.fill("m13");
  await expect(form.getByRole("option").first()).toContainText("M13");
  await picker.press("Enter");
  await expect(picker).toHaveValue(/^M13 · /);
  await expect(form.getByRole("radio", { name: "4", exact: true })).toBeChecked();
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/log(\?|$)/);
  await page.goto("/log/progress");
  await expectReached(page, "first-galaxy", galaxyNight);
  await expectReached(page, "first-globular", galaxyNight);

  // 5. Deleting the M13 entry takes the entries away, not the record: both milestones stay, on their stored nights.
  await openEntry(page, "M13");
  await waitForHydration(page, DELETE_FORM);
  await page.getByRole("button", { name: en.log.delete }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: en.log.delete }).click();
  await expect(page).toHaveURL(/\/log(\?|$)/);
  await page.goto("/log/progress");
  await expectReached(page, "first-galaxy", galaxyNight);
  await expectReached(page, "first-globular", galaxyNight);
  // The Messier count follows the log (nothing is seen now), while the record keeps what was reached.
  await expectAhead(page, "messier-10", copy.progress({ seen: "0", total: "10" }));
});
